(function (w) {
  const USER_KEY = "smartdoc_user";
  const USERS_KEY = "smartdoc_users";

  function seed() {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    function ensure(u) {
      const i = users.findIndex((x) => x.email === u.email);
      if (i < 0) users.push(u);
      else {
        if (!users[i].role) users[i].role = u.role;
        if (!users[i].name) users[i].name = u.name;
      }
    }
    ensure({
      email: "demo@smartdoc.com",
      password: "demo123",
      name: "Demo 单证专员",
      company: "Demo 国际货代有限公司",
      plan: "专业会员版",
      role: "operator",
    });
    ensure({
      email: "checker@smartdoc.com",
      password: "demo123",
      name: "Demo 复核专员",
      company: "Demo 国际货代有限公司",
      plan: "专业会员版",
      role: "checker",
    });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  seed();

  function roleOf(user) {
    if (!user) return "operator";
    if (user.role) return user.role;
    return user.email === "checker@smartdoc.com" ? "checker" : "operator";
  }

  function sessionOf(found) {
    return {
      email: found.email,
      name: found.name,
      company: found.company,
      plan: found.plan,
      role: roleOf(found),
    };
  }

  w.SmartAuth = {
    current() {
      try {
        const u = JSON.parse(localStorage.getItem(USER_KEY) || "null");
        if (u && !u.role) u.role = roleOf(u);
        return u;
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
      const session = sessionOf(found);
      localStorage.setItem(USER_KEY, JSON.stringify(session));
      return { ok: true, user: session };
    },
    switchTo(email) {
      seed();
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      const found = users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!found) return { ok: false, msg: "账号不存在" };
      const session = sessionOf(found);
      localStorage.setItem(USER_KEY, JSON.stringify(session));
      return { ok: true, user: session };
    },
    roleLabel(role) {
      return role === "checker" ? "复核员" : "制单员";
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
        role: "operator",
      };
      users.push(user);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(USER_KEY, JSON.stringify(sessionOf(user)));
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
