# 研修小组入群

Static phone lookup for three WeChat groups. MindGraph stays on port 9527. Host Nginx serves this site on port **9531**, and Nginx Proxy Manager fronts it.

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

No restart is required after replacing a picture. If WeChat still shows an old code, send the page link with a new query, for example `https://your-host/?v=2`.

## Run

Leave the existing MindGraph proxy host on port 9527 as it is. Add a second proxy host for this site.

Proxy Manager forwards to a port, so this folder needs its own listener on **9531**:

```bash
sudo git clone git@github.com:lycosa9527/yanxiu-group-lookup.git /var/www/yanxiu-group-lookup
sudo apt install nginx
sudo cp /var/www/yanxiu-group-lookup/deploy/nginx.conf /etc/nginx/conf.d/yanxiu-group-lookup.conf
sudo nginx -t && sudo systemctl reload nginx
```

That Nginx process listens on 9531 only. Ports 80 and 443 stay with Proxy Manager.

In Proxy Manager, add a proxy host:

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

Later updates are a pull. The page files are read from disk, so Nginx does not need a reload:

```bash
cd /var/www/yanxiu-group-lookup && sudo git pull
```

Teachers use one HTTPS link, not a link per person.

If `9531` is already taken, change `listen 9531` in `deploy/nginx.conf` and use that same port in Nginx Proxy Manager.

## Security

Nginx turns directory listing off, answers only GET and HEAD, and sends headers that block framing, content sniffing, and any script or style that is not part of this site.

The roster and the QR images are the access secret. Keep this repository private. Anyone who can open the page can read `teachers.js`.

Open port 80 and 443 only. Do not publish 9531 in the cloud firewall. Check both listeners with:

```bash
ss -tlnp | grep -E '9527|9531'
```
