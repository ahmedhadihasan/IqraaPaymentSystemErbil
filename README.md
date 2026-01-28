# اقرأ - لقی هەولێر

سیستەمی بەڕێوەبردنی پارەدان و قوتابیان بۆ ناوەندی خوێندن، بە دیزاینی mobile-first و بەڕێوەبردنی بەرز.

## تایبەتمەندییەکان
- بەڕێوەبردنی قوتابیان، پارەدان، و بەڕێوەبەران
- پارەدان بۆ تاک یان خوشک و برا، و ماوەی وەرز/مانگ
- لێخۆشبوون و ڕاگرتنی پارەدان
- ڕاپۆرت و فلتەری مانگانە/هەفتانە/ڕۆژانە
- هاوردە/هەناردەکردنی CSV بۆ قوتابیان
- مۆبایل‌دەست‌پێک و پەیوەست بە ڕەنگ و ئاگادارکردنەوەکان

## تکنەلۆجیا و زمانەکان
- Next.js 14 + React 18
- TypeScript
- Prisma ORM
- NextAuth
- Tailwind CSS
- TanStack React Query

## دامەزراندن
1. پێداویستییەکان
   - Node.js 18+ (پێشنیارکراو)
   - npm 9+

2. دامەزراندنی پاکێجەکان
   ```bash
   npm install
   ```

3. ڕێکخستنی ژمارەی پەیوەندی داتابەیس
   - `.env` دروست بکە و `DATABASE_URL` بنووسە.
   - بۆ SQLite:
     ```
     DATABASE_URL="file:./prisma/dev.db"
     ```

4. داتابەیس push و seed
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. کارپێکردن
   ```bash
   npm run dev
   ```

## ڕێکخستنی NextAuth
لە `.env` یان `.env.local` دا ئەمانە دابنێ:
```
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
```

## وەکوو چۆن کاردەکات
- بەڕێوەبەرەکان دەیانەوێت قوتابی هەڵبژێرن بۆ پارەدان.
- هەموو پارەدانەکان بۆ ئەم وەرزە بەشدار دەکرێن بۆ دۆخی قوتابی.
- لێخۆشبوون دەکرێت بۆ قوتابیان، بۆ ناڕێکخستنی پارەدان.
- سوپەر-ئادمین دەسترسی زیاتر هەیە بۆ بینینی هەموو قوتابیان و ڕاپۆرتەکان.

## Backup
backup ـی ڕۆژانە بۆ هەموو داتا:
```bash
npm run backup
```

دروستکردنی backup ـی ڕۆژانە بە cron:
```bash
0 1 * * * cd /Users/ahmedhadi/Desktop/IqraaPay && npm run backup:daily
```

بەکاپەکان دەچنە:
```
/backups/YYYY-MM-DD/
```

- JSON بۆ هەموو جۆرە داتا
- کۆپێی SQLite لە کاتی `DATABASE_URL` ـی file-based

## Compatibility
- macOS, Linux
- Node.js 18+
- Browsers: Chrome, Safari, Firefox (mobile/desktop)

## قەبارە و هەڵگرتن
- قەبارەی داتا پەیوەستە بە ژمارەی قوتابی و پارەدان
- backups لە Git دا نەچێن (لە .gitignore داخڵکراون)

## تاقیکردنەوە و build
```bash
npm run lint
npm run test:logic
npm run build
```
