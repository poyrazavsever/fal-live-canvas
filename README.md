# Fal Live Canvas

Fal Live Canvas, solda cizim yapip sagda AI ile fotogercekci gorsel ureten bir Next.js App Router projesidir.

## Ozellikler

- 512x512 canvas cizim alani
- Renk secimi (color picker)
- Manuel uretim akisi (Olustur butonu)
- Uretim sirasinda yukleniyor durumu ve UI geri bildirimi
- Sunucu tarafi Route Handler ile FAL API anahtari korumasi
- Nano Banana Pro edit modeli ile sketch -> photorealistic donusum

## Teknoloji

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4
- @fal-ai/client

## Kurulum

1. Bagimliliklari yukleyin:

```bash
npm install
```

2. Proje kok dizininde .env.local olusturun veya duzenleyin:

```env
FAL_KEY=your_fal_key_here
```

3. Gelistirme sunucusunu baslatin:

```bash
npm run dev
```

4. Tarayicida acin:

http://localhost:3000

## Kullanim

1. Sol panelde canvas ustunde bir cizim yapin.
2. Kalem rengini color picker ile degistirin.
3. Olustur butonuna basin.
4. Sag panelde AI ciktisini gorun.

## API Akisi

Frontend Fal API'ye direkt gitmez.

- Frontend -> POST /api/generate
- Route Handler -> Fal modeli cagrisi
- Sonuc -> imageUrl olarak frontend'e doner

Boylece FAL_KEY sadece sunucuda kullanilir.

## Kullanilan Model

- Model ID: fal-ai/nano-banana-pro/edit
- Tip: image-to-image edit

Route varsayilan olarak su sekilde cagirir:

- image_urls: [canvas data URL]
- aspect_ratio: 1:1
- resolution: 1K
- output_format: jpeg
- num_images: 1

Not: Nano Banana Pro ucretli bir modeldir. Her uretim maliyet olusturur.

## Scriptler

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Onemli Dosyalar

- app/page.tsx: Cizim arayuzu ve istemci akisi
- app/api/generate/route.ts: Sunucu tarafi Fal entegrasyonu
- app/layout.tsx: Uygulama layout ve font ayari
- app/globals.css: Global stiller
