# 研修小组入群

Static phone lookup for three WeChat groups. MindGraph stays on port 9527. This site is a separate Nginx process on port **9531**, fronted by a new Nginx Proxy Manager proxy host.

## Roster

`scripts/import_roster.py` writes `public/teachers.js`. One row per teacher who submitted the questionnaire:

```javascript
window.ROSTER = [
  { name: "张三", phone6: "123456", group: "单元设计组" },
  { name: "李四", phone6: "234567", group: "探究实验组" },
  { name: "王五", phone6: "345678", group: "做中学组" },
  { name: "赵六", phone6: "456789", group: "待定" },
];
```

`phone6` stays a quoted string. `group` is `单元设计组`, `探究实验组`, `做中学组`, `待沟通`, or `待定`. `待沟通` tells the teacher to contact 董老师. A row whose phone tail is not six digits does the same when the name matches. `待定` lets the teacher choose a group. Anyone absent from this file is treated as not having filled the questionnaire.

## Import

`data/roster.sqlite` holds the roster, including each school. Load the questionnaire workbook with:

```bash
python3 scripts/import_roster.py "/path/to/教师进群信息表.xlsx"
```

The command replaces that database and rewrites `public/teachers.js`. A phone tail that is not six digits is still published, and the page asks that teacher to contact 董老师.

Copy this folder to the server with rsync or scp. `public/teachers.js` holds names and phone tails, and the QR images are live join codes. Keep both on this machine and on the server. Nginx only serves `public/`, so `data/roster.sqlite` stays off the site.

## QR codes

The pictures already on the page expire before 1 December 2026. Replace these files with the new exports. Keep the names:

- `public/qr/unit-design.png` — 单元设计组
- `public/qr/inquiry.png` — 探究实验组
- `public/qr/learning-by-doing.png` — 做中学组

No restart is required. The folder is mounted into Nginx. If WeChat still shows an old code, send the page link with a new query, for example `https://your-host/?v=2`.

## Run

From this directory's `deploy/` folder on the server:

```bash
docker compose up -d
```

Teachers use one HTTPS link, not a link per person.

## Nginx Proxy Manager

Add a **new** proxy host. Leave the MindGraph host on port 9527 as it is.

1. DNS: an A record for a hostname you choose, pointing at this same server. Example: `yanxiu.mindspringedu.com`.
2. Proxy Host → Details
   - Domain: that hostname
   - Scheme: `http`
   - Forward hostname: the same value the MindGraph proxy host uses
   - Forward port: `9531`
   - Block Common Exploits: on
   - Websockets: off
   - Cache Assets: off
3. SSL: request a certificate, Force SSL on.

If `9531` is already taken, change the left-hand side of `9531:80` in `deploy/docker-compose.yml` and use that same port in Nginx Proxy Manager.

## Security

Nginx turns directory listing off, answers only GET and HEAD, and sends headers that block framing, content sniffing, and any script or style that is not part of this site. The container drops the ability to gain extra privileges.

The roster and the QR images are the access secret. Keep this repository private. Anyone who can open the page can read `teachers.js`.

Open port 80 and 443 only. Do not publish 9531 in the cloud firewall. Check both listeners with:

```bash
ss -tlnp | grep -E '9527|9531'
```
