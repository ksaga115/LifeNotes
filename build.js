/*
 * src/ のソースから、配布物を2種類つくる。
 *
 *   node build.js
 *
 *   docs/  GitHub Pages で公開する形。これが本命（スマホで URL を開ければいいので）
 *            docs/index.html              索引
 *            docs/<slug>/index.html       各ノート
 *   dist/  1ファイルで渡す形。PC や Android に直接ファイルを送りたいとき用
 *
 * src/ のソースは <title> から始まる body 断片。doctype / head / 最小限のリセットは
 * ここで足して、完結した HTML にする。（Artifact として publish する場合は
 * プラットフォーム側が同じものを足すので、ソースには持たせない）
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const DOCS = path.join(__dirname, "docs");
const DIST = path.join(__dirname, "dist");

/* 公開するノート。slug が公開 URL になる。
   ready:false のものは索引に「準備中」で出すだけで、ページは作らない */
const NOTES = [
  {
    src: "okuyami.html",
    slug: "inheritance",
    title: "おくやみノート",
    dist: "おくやみノート.html",
    desc: "身近な人が亡くなったあとの手続きを、期限の順に。死亡届の7日から、相続登記の3年まで。",
    ready: true,
  },
  {
    src: "kaigo.html",
    slug: "care",
    title: "介護のノート",
    dist: "介護のノート.html",
    desc: "親の介護が始まったら。まず地域包括支援センターへ。認定、ケアプラン、費用、仕事との両立まで。",
    ready: true,
  },
  {
    src: "taishoku.html",
    slug: "leaving",
    title: "退職のノート",
    dist: "退職のノート.html",
    desc: "退職日を入れると期限が並びます。健康保険の20日、失業給付、住民税、退職金の税。",
    ready: true,
  },
  {
    src: "kakutei.html",
    slug: "tax",
    title: "確定申告ノート",
    dist: "確定申告ノート.html",
    desc: "還付申告、副業の申告、事業所得。何を集めて、いつまでに出すか。期限は自動で数えます。",
    ready: true,
  },
  {
    src: "bousai.html",
    slug: "disaster",
    title: "防災の備蓄ノート",
    dist: "防災の備蓄ノート.html",
    desc: "家族構成を入れると必要量が出ます。買ったものの期限を追って、入れ替え時期を知らせます。",
    ready: true,
  },
  {
    src: "hikkoshi.html",
    slug: "moving",
    title: "引っ越しノート",
    dist: "引っ越しノート.html",
    desc: "引っ越す日を入れると、前後の期限が並びます。転入届の14日、免許証、ライフラインまで。",
    ready: true,
  },
];

/* このリポジトリの外にある姉妹ノート。索引からリンクするだけ */
const OUTSIDE = [
  {
    href: "https://ksaga115.github.io/PregnancyNotes/",
    title: "妊娠40週ノート",
    desc: "妊娠0週から40週まで。赤ちゃんの育ち、からだ、この週にすること。",
  },
  {
    href: "https://ksaga115.github.io/PregnancyNotes/postpartum/",
    title: "産後365日ノート",
    desc: "出産当日から1歳まで。予防接種、健診、離乳食、授乳の記録。",
  },
];

const SITE = "くらしのノート";
const OG_DESC = "広告も関連記事もない、暮らしの手続きのノート。制度の記述には出典つき。スマホで読めます。";

/* publish ラッパが入れていたリセット相当。とくに [hidden] は el.hidden で
   表示を切り替えているので必須。 */
/* head に入れる最小限。ページを移ったときの「真っ白な一瞬」を消すためのもの。
   (1) 本体の CSS は <body> 側にあるので、最初の描画に間に合うよう背景色だけ head で決める
   (2) 保存された配色を、描画される前に <html> へ当てる（あとから当てると一瞬ちらつく）
   背景色は _base.css の --ground と同じ値。片方だけ変えるとここがズレる。 */
const GROUND_LIGHT = "#F3F3F0";
const GROUND_DARK  = "#161917";
const HEAD_BOOT = [
  "<style>",
  "html{color-scheme:light dark;background:" + GROUND_LIGHT + "}",
  '@media (prefers-color-scheme:dark){html:not([data-theme="light"]){background:' + GROUND_DARK + "}}",
  'html[data-theme="dark"]{color-scheme:dark;background:' + GROUND_DARK + "}",
  'html[data-theme="light"]{color-scheme:light;background:' + GROUND_LIGHT + "}",
  "</style>",
  "<script>(function(){try{var t=localStorage.getItem('kurashi.theme.v1');" +
  "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();" +
  "<" + "/script>",
  "",
].join("\n");

/* 全ノート共通のスタイル。各ソースの <style> 内の %%CSS%% に差し込む */
const BASE_CSS = fs.readFileSync(path.join(SRC, "_base.css"), "utf8").trim();

const RESET = [
  "html{color-scheme:light dark}",
  ":root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}",
  "img{max-width:100%}",
  "[hidden]{display:none!important}",
].join("\n");

function wrap(rawBody, opt) {
  let body = rawBody;

  const title = (body.match(/<title>(.*?)<\/title>/) || [])[1] || SITE;
  body = body.replace(/<title>.*?<\/title>\s*/, "");

  /* 索引への戻り先を、この出力先での行き先に差し替える */
  if (opt && opt.homeHref) body = body.split("%%HOME%%").join(opt.homeHref);

  /* ノート間リンク %%NOTE:slug%% を、この出力先での行き先に差し替える
     （docs は ../<slug>/、dist はファイル名。どちらかに片寄らせると必ず片方が壊れる） */
  body = body.replace(/%%NOTE:([a-z-]+)%%/g, function (m, slug) {
    var n = NOTES.filter(function (x) { return x.slug === slug; })[0];
    if (!n || !n.ready) return opt && opt.docs ? "../" : "くらしのノート.html";
    return opt && opt.docs ? "../" + n.slug + "/" : encodeURI(n.dist);
  });

  /* フォントの <link> を head に移す */
  const links = [];
  body = body.replace(/^[ \t]*<link [^>]*>[ \t]*\r?\n/gm, function (m) {
    const tag = m.trim();
    const href = (tag.match(/href="([^"]+)"/) || [])[1];
    /* stylesheet をそのまま head に置くと描画をブロックする。日本語ウェブフォントは重いので、
       ページを移るたび「真っ白な一瞬」ができる。media="print" で読み込んで onload で有効化する。 */
    if (/rel="stylesheet"/.test(tag) && href) {
      links.push('<link rel="preload" as="style" href="' + href + '">');
      links.push('<link rel="stylesheet" href="' + href + '" media="print" onload="this.media=\'all\'">');
      links.push('<noscript><link rel="stylesheet" href="' + href + '"></noscript>');
    } else {
      links.push(tag);
    }
    return "";
  });

  /* 共通のスタイルシートを流し込む（src/_base.css。ノート間でズレないよう1か所で持つ） */
  body = body.split("%%CSS%%").join(BASE_CSS);

  /* ページ自身の CSS の手前にリセットを差し込む */
  body = body.replace("<style>", "<style>\n" + RESET + "\n");

  const desc = (opt && opt.desc) || OG_DESC;

  return (
    "<!doctype html>\n" +
    '<html lang="ja">\n' +
    "<head>\n" +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '<meta name="color-scheme" content="light dark">\n' +
    '<meta name="description" content="' + esc(desc) + '">\n' +
    '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n' +
    '<meta name="apple-mobile-web-app-title" content="' + esc(title) + '">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:title" content="' + esc(title) + '">\n' +
    '<meta property="og:description" content="' + esc(desc) + '">\n' +
    "<title>" + esc(title) + "</title>\n" +
    HEAD_BOOT +
    links.join("\n") + (links.length ? "\n" : "") +
    "</head>\n<body>\n" +
    body.trim() +
    "\n</body>\n</html>\n"
  );
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function write(dest, html) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html, "utf8");
  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
  console.log("  " + path.relative(__dirname, dest).replace(/\\/g, "/") + " — " + kb + " KB");
}

/* ---------- 索引 ---------- */

function indexHTML(forDocs) {
  const card = (href, n, state) => {
    /* 行き先のないカードは <a> にしない（クリックできそうに見えてしまうので） */
    const tag = href ? "a" : "span";
    const attr = href ? ' href="' + href + '"' : "";
    return "<" + tag + ' class="card' + (state ? " " + state : "") + '"' + attr + ">" +
      '<span class="card-t">' + esc(n.title) + "</span>" +
      '<span class="card-d">' + esc(n.desc) + "</span>" +
      (state === "soon" ? '<span class="card-s">準備中</span>' : "") +
      "</" + tag + ">";
  };

  let cards = "";
  for (const n of NOTES) {
    cards += card(n.ready ? (forDocs ? n.slug + "/" : n.dist) : "", n, n.ready ? "" : "soon");
  }
  let out = "";
  for (const n of OUTSIDE) out += card(n.href, n, "");

  const raw = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
  return wrap(raw.replace("%%CARDS%%", cards).replace("%%OUTSIDE%%", out), { desc: OG_DESC });
}

/* ---------- 実行 ---------- */

console.log("docs/ (GitHub Pages)");
write(path.join(DOCS, "index.html"), indexHTML(true));
for (const n of NOTES) {
  if (!n.ready) continue;
  const raw = fs.readFileSync(path.join(SRC, n.src), "utf8");
  write(path.join(DOCS, n.slug, "index.html"), wrap(raw, { homeHref: "../", desc: n.desc, docs: true }));
}
fs.writeFileSync(path.join(DOCS, ".nojekyll"), "");

console.log("dist/ (ファイルで渡す用)");
write(path.join(DIST, "くらしのノート.html"), indexHTML(false));
for (const n of NOTES) {
  if (!n.ready) continue;
  const raw = fs.readFileSync(path.join(SRC, n.src), "utf8");
  write(path.join(DIST, n.dist), wrap(raw, { homeHref: "くらしのノート.html", desc: n.desc, docs: false }));
}
