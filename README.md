# -01
زياده الخير خيرين

## MCP: 21st

خادم MCP مُعرّف في `.mcp.json` (نطاق المشروع). المفتاح غير مخزّن في المستودع —
يُقرأ من متغير البيئة `API_KEY_21ST` وقت التشغيل:

```bash
export API_KEY_21ST="<your-21st-dev-api-key>"
claude   # ثم وافق على الخادم عند أول تشغيل
```

> ملاحظة: `21st.dev` محجوب في بيئة Claude Code السحابية (سياسة الشبكة)،
> فالخادم يعمل محلياً فقط.

## Global Network map (Next.js)

عرض `WorldMap` — خريطة نقطية مع أقواس متحركة بين المدن.

```bash
npm install
npm run dev     # http://localhost:3000
```

- `components/ui/map.tsx` — المكوّن (client component).
- `scripts/generate-map.mjs` — يولّد `public/world-map-{light,dark}.svg`
  و`components/ui/map.projection.ts`. يعمل تلقائياً قبل `build`، أو يدوياً عبر
  `npm run generate:map`. الغرض إبقاء `dotted-map` وبيانات الدول خارج حزمة المتصفح.

**ملاحظة عن الإسقاط:** `dotted-map` يستخدم **Mercator** مقصوصاً على
`lat −56..71 / lng −168..168` بصندوق عرض `198×100` — وليس شبكة equirectangular
بمقاس `800×400`. المكوّن يعكس هذا الإسقاط بالضبط، فتقع المدن على نقاطها الحقيقية.
