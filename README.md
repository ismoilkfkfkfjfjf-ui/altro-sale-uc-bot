# 🎮 ALTRO UC BIT — PUBG UC Tap-to-Earn Web App & Telegram Bot

PUBG Mobile o'yinchilari uchun maxsus yaratilgan **ALTRO UC BIT** o'yini va Telegram boti!
Foydalanuvchilar ekrandagi UC kartasini bosib **Altro UC** to'playdilar, kuchaytiradilar (boosts), vazifalarni bajaradilar va to'plangan Altro UC larni o'zlarining **PUBG Mobile Player ID (UID)** lariga haqiqiy **PUBG UC** qilib yechib oladilar!

---

## ⚡ Asosiy Imkoniyatlar

1. **🪙 O'yin (Tap / Clicker):**
   - **Dumaloq VIP Medalyon:** 3D perspective tilt effekti, silliq `border-radius: 36px` va aylanuvchi oltin halqalar.
   - **Oltin zarrachalar va to'lqinlar (Ripple FX):** Har bir bosishda ekranda oltin doiraviy to'lqin tarqaladi.
   - **0ms kechikishli arkada ovozi:** Web Audio API orqali ikki qavatli tiniq metall tanga ovozi va Telegram Haptic tebranishi.
   - **Elektr energiya tizimi:** Real vaqtda avtomatik tiklanadi.

2. **🚀 Kuchaytirish (Boosts):**
   - **Multitap:** Har bir bosishda ko'proq Altro beradi (+1, +2, +3...).
   - **Energiya sig'imi:** Maksimal energiya hajmini oshiradi (+500 har darajada).
   - **Tiklanish tezligi:** Energiya to'lishini tezlashtiradi (+1/soniya).
   - **Bepul Turbo:** Har kuni 3 marta energiyani zudlik bilan 100% to'ldirish!

3. **💎 PUBG UC Yechib Olish:**
   - **8,000 Altro UC = 30 UC**
   - **16,000 Altro UC = 60 UC**
   - **80,000 Altro UC = 300 + 25 UC**
   - **160,000 Altro UC = 600 + 60 UC (Royale Pass)**
   - PUBG Player ID (UID) va Nickname kiritish orqali tezkor ariza.

4. **👤 Profil & Tarix:**
   - Foydalanuvchi ma'lumotlari, Telegram ID, PUBG ID.
   - Jami yig'ilgan Altro UC va jami chiqarib olingan PUBG UC hisoboti.
   - Yechib olish arizalari tarixi: ⏳ Kutilmoqda, ✅ Tushirib berildi, ❌ Rad etildi.

5. **👑 To'liq Admin Panel (Tahrirlash imkoniyati bilan):**
   - **UC Paketlarini Tahrirlash:** Istalgan paketning Altro narxi, UC miqdori, nomi va belgisini istalgan payt o'zgartirish (Edit) va o'chirish.
   - **Majburiy Kanallarni Tahrirlash:** Kanallarni tahrirlash (Edit) va o'chirish.
   - **Vazifalarni Tahrirlash:** YouTube va boshqa shartlarni tahrirlash (Edit) va o'chirish.
   - **Arizalarni Boshqarish:** 1-bosish bilan Tasdiqlash yoki Rad etish (foydalanuvchiga Telegram orqali xabar boradi).
   - **Mijozlar & Balans (30,000+ kishilik tezkor baza):** Foydalanuvchilarni qidirish, balansini o'zgartirish.
   - **Xabar Yuborish (Broadcast):** Barcha o'yinchilarga rasm va matnli e'lonlarni jo'natish.

---

## ☁️ Render.com Ga Joylash (1-Click Deployment)

Loyiha **Render.com** da to'liq ishlashga 100% tayyorlangan (`render.yaml` mavjud):

### 1-qadam: GitHub ga yuklash
Loyihani GitHub akkauntingizga yuklang (push qiling).

### 2-qadam: Render.com da servis yaratish
1. [Render.com](https://render.com) ga kiring va ro'yxatdan o'ting.
2. **"New +"** tugmasini bosing va **"Web Service"** ni tanlang.
3. GitHub dagi `ALTRO UC BIT` repositoriyangizni ulang.
4. Render quyidagi parametrlarni avtomatik taniydi:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** `Free`

### 3-qadam: Environment Variables (O'zgaruvchilar) ni kiritish
Render boshqaruv panelida **"Environment"** bo'limiga quyidagilarni kiriting:
- `BOT_TOKEN` = O'zingizning @BotFather dan olgan bot tokeningiz (masalan `7123456789:AAEf...`)
- `WEBAPP_URL` = Render sizga beradigan domen (masalan `https://altro-uc-bit.onrender.com`)
- `ADMIN_IDS` = O'zingizning Telegram raqamli ID ingiz (masalan `123456789`)

**"Deploy Web Service"** tugmasini bosing! 2-3 daqiqada loyiha global internetda ishga tushadi! 🚀

---

## 🤖 Telegram Botda Web App ulash (BotFather)

1. Telegramda `@BotFather` ga kiring.
2. `/newapp` buyrug'ini yuboring.
3. Botingizni tanlang.
4. Sarlavha: `ALTRO UC BIT`
5. Tavsif: `PUBG Mobile UC Tap-to-Earn O'yini`
6. Rasm (640x360) yuboring.
7. Web App URL: Render bergan havola (masalan: `https://altro-uc-bit.onrender.com`).
8. Qisqa nom (short name) tanlang: masalan `play` yoki `game`.

Foydalanuvchi botga `/start` bosganda chiroyli `⚡ O'YINNI BOSHLASH (WEB APP) ⚡` tugmasi paydo bo'ladi va o'yin ochiladi!
Admin bo'lsa unga qo'shimcha ravishda **Admin Panel PRO** tugmasi chiqadi.

---

## 💻 Kompyuterda Lokal Ishga Tushirish
1. `start.bat` faylini ikki marta bosing!
2. Brauzerda oching:
   - **O'yin (Web App):** [http://localhost:3000](http://localhost:3000)
   - **Admin Panel (Ega):** [http://localhost:3000/admin.html?admin_id=7081580477](http://localhost:3000/admin.html?admin_id=7081580477)
   - **Admin Panel (Admin):** [http://localhost:3000/admin.html?admin_id=8422157752](http://localhost:3000/admin.html?admin_id=8422157752)
