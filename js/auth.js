(function (w) {
  const USER_KEY = "smartdoc_user";
  const USERS_KEY = "smartdoc_users";

  function seed() {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    if (!users.find((u) => u.email === "demo@smartdoc.com")) {
      users.push({
        email: "demo@smartdoc.com",
        password: "demo123",
        name: "Demo 单证专员",
        company: "Demo 国际货代有限公司",
        plan: "专业会员版",
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }
  seed();

  w.SmartAuth = {
    current() {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY) || "null");
      } catch (e) {
        return null;
      }
    },
    login(email, password) {
      seed();
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      const found = users.find(
        (u) => u.email.toLowerCase() === String(email).trim().toLowerCase() && u.password === password
      );
      if (!found) return { ok: false, msg: "邮箱或密码不正确" };
      const session = { email: found.email, name: found.name, company: found.company, plan: found.plan };
      localStorage.setItem(USER_KEY, JSON.stringify(session));
      return { ok: true, user: session };
    },
    register(payload) {
      seed();
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      const email = String(payload.email || "").trim().toLowerCase();
      if (!email || !payload.password || !payload.name) return { ok: false, msg: "请完整填写注册信息" };
      if (users.find((u) => u.email === email)) return { ok: false, msg: "该邮箱已注册，请直接登录" };
      const user = {
        email,
        password: payload.password,
        name: payload.name,
        company: payload.company || payload.name + " 货代",
        plan: "免费体验版",
      };
      users.push(user);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(USER_KEY, JSON.stringify({ email: user.email, name: user.name, company: user.company, plan: user.plan }));
      return { ok: true };
    },
    logout() {
      localStorage.removeItem(USER_KEY);
      location.href = "index.html";
    },
    require() {
      if (!this.current()) {
        if (location.hash && location.hash.indexOf("#sd=") === 0) {
          if (w.SmartShare) {
            try {
              const pack = w.SmartShare.decode(location.hash);
              if (pack && pack.readOnly) {
                location.replace("view.html" + location.hash);
                return;
              }
            } catch (e) { /* fall through to login */ }
          }
          try { sessionStorage.setItem("smartdoc_pending_share", location.hash); } catch (e) { /* ignore */ }
        }
        location.replace("login.html");
      }
    },
  };
})(window);
