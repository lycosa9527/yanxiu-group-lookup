const { lookup } = require("./public/lookup.js");

const roster = [
    { name: "张三", phone6: "123456", group: "单元设计组" },
    { name: "李四", phone6: "234567", group: "探究实验组" },
    { name: "王五", phone6: "345678", group: "做中学组" },
    { name: "赵六", phone6: "456789", group: "待定" },
    { name: "钱七", phone6: "13800001111", group: "单元设计" },
    { name: "孙八", phone6: "012345", group: "做中学组" },
    { name: "周九", phone6: "567890", group: "未分组" },
    { name: "Tom", phone6: "678901", group: "" },
    { name: "吴十", phone6: "111222", group: "待沟通" },
    { name: "郑十一", phone6: "待核实", group: "单元设计组" },
    { name: "冯十二", phone6: "", group: "做中学组" },
];

function assertKind(name, phone, kind, group) {
    const outcome = lookup(roster, name, phone);
    if (outcome.kind !== kind) {
        throw new Error(`${name} / ${phone} → ${outcome.kind}, expected ${kind}`);
    }
    if (group && outcome.group !== group) {
        throw new Error(`${name} group ${outcome.group}, expected ${group}`);
    }
}

assertKind("张三", "123456", "assigned", "单元设计组");
assertKind("张 三", "123456", "assigned", "单元设计组");
assertKind("张三", "13800123456", "assigned", "单元设计组");
assertKind("张三", "+86 13800123456", "assigned", "单元设计组");
assertKind("张三", "１３８００１２３４５６", "assigned", "单元设计组");
assertKind("李四", "234567", "assigned", "探究实验组");
assertKind("王五", "345678", "assigned", "做中学组");
assertKind("赵六", "456789", "pending");
assertKind("钱七", "001111", "assigned", "单元设计组");
assertKind("孙八", "012345", "assigned", "做中学组");
assertKind("周九", "567890", "pending");
assertKind("tom", "678901", "pending");
assertKind("吴十", "111222", "contact");
assertKind("吴十", "000000", "missing");
assertKind("郑十一", "123456", "contact");
assertKind("冯十二", "654321", "contact");
assertKind("无人", "123456", "missing");
assertKind("张三", "12345", "invalid");
assertKind("张三", "1234567", "invalid");
assertKind("", "", "invalid");
assertKind("", "123456", "invalid");

const conflict = lookup([
    { name: "张三", phone6: "123456", group: "单元设计组" },
    { name: "张三", phone6: "123456", group: "探究实验组" },
], "张三", "123456");
if (conflict.kind !== "duplicate") {
    throw new Error(`conflict → ${conflict.kind}`);
}

const agreed = lookup([
    { name: "张三", phone6: "123456", group: "单元设计组" },
    { name: "张三", phone6: "123456", group: "单元设计组" },
], "张三", "123456");
if (agreed.kind !== "assigned" || agreed.group !== "单元设计组") {
    throw new Error(`agreed → ${JSON.stringify(agreed)}`);
}

const bad = lookup([
    { name: "张三", phone6: "123456", group: "其他组" },
], "张三", "123456");
if (bad.kind !== "badgroup") {
    throw new Error(`bad → ${bad.kind}`);
}

if (lookup([], "张三", "123456").kind !== "empty") {
    throw new Error("empty roster");
}
if (lookup(null, "张三", "123456").kind !== "noroster") {
    throw new Error("missing roster");
}

console.log("lookup ok");
