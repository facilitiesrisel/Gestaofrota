const fs = require('fs');

async function test() {
  const url = "https://riselcombustiveis-my.sharepoint.com/:x:/g/personal/deny_goncalves_risel_com_br/IQAaoMgIpUU5RJT0XwUF7eOzAYV0pCLYDAlOmFtiaTpQbso?e=DvzFtV";
  const r1 = await fetch(url, { redirect: "manual" });
  const loc1 = r1.headers.get("location");
  const cookies1 = r1.headers.getSetCookie ? r1.headers.getSetCookie() : [r1.headers.get("set-cookie")];
  
  console.log("R1 location:", loc1);
  console.log("Cookies count:", cookies1.length);

  const r2 = await fetch(loc1, {
    headers: {
      "Cookie": cookies1.join("; "),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  console.log("R2 final URL:", r2.url);
  console.log("R2 status:", r2.status);
  console.log("R2 content-type:", r2.headers.get("content-type"));
  const html = await r2.text();
  console.log("R2 html length:", html.length);
  fs.writeFileSync("/tmp/sp_page.html", html);

  // Search for download links or api endpoints in the html
  const regexes = [
    /"downloadUrl"\s*:\s*"([^"]+)"/i,
    /"FileGetUrl"\s*:\s*"([^"]+)"/i,
    /https:\/\/[^"'\s]+\/download\.aspx[^"'\s]*/i,
    /https:\/\/[^"'\s]+sourcedoc=[^"'\s]*/i,
    /_layouts\/15\/download\.aspx[^"'\s]*/i
  ];

  for (const r of regexes) {
    const match = html.match(r);
    console.log("Pattern:", r.toString(), "Found:", match ? match[0].substring(0, 120) : "none");
  }
}

test().catch(console.error);
