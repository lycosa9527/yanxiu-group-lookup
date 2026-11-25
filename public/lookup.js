/* Roster lookup for the teacher group join page. */
(function attachLookup(root) {
    const GROUP_ORDER = ["单元设计组", "探究实验组", "做中学组"];
    const GROUP_QR = {
        单元设计组: "qr/unit-design.png",
        探究实验组: "qr/inquiry.png",
        做中学组: "qr/learning-by-doing.png",
    };
    const PENDING = {
        "": true,
        待定: true,
        未分组: true,
        暂不分组: true,
    };
    const CONTACT = {
        待沟通: true,
    };

    function compactName(value) {
        return String(value || "").replace(/\s+/g, "").toLowerCase();
    }

    function digitsOnly(value) {
        return String(value || "")
            .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
            .replace(/\D/g, "");
    }

    function phoneTail(value) {
        let digits = digitsOnly(value);
        if (digits.length === 13 && digits.startsWith("86")) {
            digits = digits.slice(2);
        }
        if (digits.length === 11) {
            return digits.slice(-6);
        }
        if (digits.length === 6) {
            return digits;
        }
        return "";
    }

    function isContactGroup(value) {
        const text = String(value || "").replace(/\s+/g, "");
        return Object.prototype.hasOwnProperty.call(CONTACT, text);
    }

    function canonicalGroup(value) {
        const text = String(value || "").replace(/\s+/g, "");
        if (Object.prototype.hasOwnProperty.call(PENDING, text)) {
            return "";
        }
        if (text === "单元设计" || text === "单元设计组") {
            return "单元设计组";
        }
        if (text === "探究实验" || text === "探究实验组") {
            return "探究实验组";
        }
        if (text === "做中学" || text === "做中学组") {
            return "做中学组";
        }
        return null;
    }

    function lookup(roster, name, phoneRaw) {
        const compact = compactName(name);
        const phone = phoneTail(phoneRaw);
        if (!compact && !phone) {
            return { kind: "invalid", reason: "both" };
        }
        if (!compact) {
            return { kind: "invalid", reason: "name" };
        }
        if (!phone) {
            return { kind: "invalid", reason: "phone" };
        }
        if (!Array.isArray(roster)) {
            return { kind: "noroster" };
        }
        if (roster.length === 0) {
            return { kind: "empty" };
        }

        const matched = [];
        let namedWithoutPhone = false;
        for (let index = 0; index < roster.length; index += 1) {
            const row = roster[index];
            if (!row || compactName(row.name) !== compact) {
                continue;
            }
            if (phoneTail(row.phone6) === "") {
                namedWithoutPhone = true;
                continue;
            }
            if (phoneTail(row.phone6) !== phone) {
                continue;
            }
            matched.push(row);
        }
        if (matched.length === 0) {
            if (namedWithoutPhone) {
                return { kind: "contact" };
            }
            return { kind: "missing" };
        }

        const groups = [];
        for (let index = 0; index < matched.length; index += 1) {
            const row = matched[index];
            if (isContactGroup(row.group)) {
                groups.push("contact");
            } else {
                groups.push(canonicalGroup(row.group));
            }
        }
        if (groups.some((group) => group === null)) {
            return { kind: "badgroup" };
        }
        const unique = groups.filter((group, index) => groups.indexOf(group) === index);
        if (unique.length !== 1) {
            return { kind: "duplicate" };
        }
        if (unique[0] === "contact") {
            return { kind: "contact" };
        }
        if (unique[0] === "") {
            return { kind: "pending" };
        }
        return { kind: "assigned", group: unique[0] };
    }

    const api = {
        GROUP_ORDER,
        GROUP_QR,
        lookup,
        phoneTail,
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    root.YanxiuLookup = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
