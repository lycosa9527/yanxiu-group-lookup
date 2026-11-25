(function () {
  var form = document.getElementById("lookup");
  var nameInput = document.getElementById("name");
  var phoneInput = document.getElementById("phone");
  var result = document.getElementById("result");
  var setup = document.getElementById("setup");
  var copy = {
    both: "请输入姓名和手机号后六位。",
    name: "请输入姓名。",
    phone: "请输入手机号后六位。",
    noroster: "名册文件未就绪，请联系管理员。",
    empty: "名册还是空的，请先写入教师名单。",
    missing: "您未填写问卷，请联系教研员邀请您入群。",
    duplicate: "查询到多条不一致的记录，请联系教研员核对。",
    badgroup: "分组信息有误，请联系教研员。",
    pending: "您好，请您结合研究专长和专业发展需要，选择其中一个群进入，也可暂不选择。",
    contact: "请联系董老师。",
    broken: "页面未加载完整，请刷新后再试。"
  };

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function add(parent, tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    if (text) {
      node.textContent = text;
    }
    parent.appendChild(node);
    return node;
  }

  function assetUrl(path) {
    var version = new URLSearchParams(location.search).get("v");
    if (!version) {
      return path;
    }
    return path + "?v=" + encodeURIComponent(version);
  }

  function qrFigure(group) {
    var figure = document.createElement("figure");
    figure.className = "qr-card";
    add(figure, "figcaption", "qr-label", group);
    var img = document.createElement("img");
    img.alt = group + "微信群二维码";
    img.width = 552;
    img.height = 718;
    img.src = assetUrl(window.YanxiuLookup.GROUP_QR[group]);
    img.addEventListener("error", function () {
      var missing = document.createElement("p");
      missing.className = "qr-missing";
      missing.textContent = "二维码图片缺失，请联系教研员。";
      if (img.parentNode) {
        img.parentNode.replaceChild(missing, img);
      }
    });
    figure.appendChild(img);
    return figure;
  }

  function message(outcome) {
    if (outcome.kind === "invalid") {
      return copy[outcome.reason] || copy.both;
    }
    if (outcome.kind === "assigned") {
      return "您好，欢迎您加入" + outcome.group + "，请扫码进群";
    }
    return copy[outcome.kind] || copy.broken;
  }

  function render(outcome) {
    clear(result);
    var tone = "warn";
    if (outcome.kind === "assigned" || outcome.kind === "pending") {
      tone = "ok";
    } else if (outcome.kind === "missing") {
      tone = "miss";
    }
    add(result, "p", "banner " + tone, message(outcome));
    if (outcome.kind !== "assigned" && outcome.kind !== "pending") {
      return;
    }
    var groups = outcome.kind === "assigned"
      ? [outcome.group]
      : window.YanxiuLookup.GROUP_ORDER;
    for (var i = 0; i < groups.length; i += 1) {
      result.appendChild(qrFigure(groups[i]));
    }
    add(result, "p", "fineprint", "在微信中打开本页后，长按二维码即可识别入群。");
    add(result, "p", "fineprint", "该二维码7天内（12月1日前）有效，重新进入将更新。");
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showSetup() {
    if (!window.YanxiuLookup || !Array.isArray(window.ROSTER)) {
      setup.hidden = false;
      setup.textContent = "未找到教师名册，请先写入 teachers.js。";
      return;
    }
    if (window.ROSTER.length === 0) {
      setup.hidden = false;
      setup.textContent = "名册还是空的。写入教师名单后即可查询。";
      return;
    }
    setup.hidden = true;
    setup.textContent = "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!window.YanxiuLookup) {
      render({ kind: "broken" });
      return;
    }
    render(window.YanxiuLookup.lookup(window.ROSTER, nameInput.value, phoneInput.value));
  });
  nameInput.addEventListener("input", function () { clear(result); });
  phoneInput.addEventListener("input", function () { clear(result); });
  showSetup();
}());
