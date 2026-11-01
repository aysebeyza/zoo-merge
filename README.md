# Zoo Merge

Yumurtaları birleştirip yeni hayvanlar çıkardığın, hayvanların gezdiği parkı büyüttüğün bir birleştirme oyunu. React Native ve Expo ile yapılıyor.

## Çalıştırma

```bash
npm install
npx expo start
```

Terminalde çıkan QR kodu telefondaki Expo Go uygulamasıyla okut.

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npx expo start` | Geliştirme sunucusunu başlatır |
| `npm test` | Oyun mantığı testlerini çalıştırır |
| `npm run typecheck` | TypeScript hatalarını kontrol eder |

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `src/game/` | Oyunun kuralları ve sayıları. Arayüzden bağımsız, testli. |
| `src/game/config.ts` | Hayvan tablosu, kuluçka süreleri, altın değerleri, yumurta fiyatı |
| `src/game/colors.ts` | Renk karışımı kuralları |
| `src/game/state.ts` | Oyun durumu ve tüm hamleler (yumurta alma, birleştirme, kuluçka, park) |
| `src/components/` | Ekran parçaları: yumurta, park, kuluçka makinesi, üst bilgi çubuğu |
| `src/app/` | Ekranlar (Expo Router) |

Oyunun dengesini değiştirmek için çoğu zaman yalnızca `src/game/config.ts` dosyasını düzenlemek yeterli.

## Şu an oyunda olanlar

- 4x3 birleştirme alanı, sürükle-bırak ile birleştirme
- Renk karışımı (kırmızı + mavi = mor, saf ve desenli haller)
- 2 yuvalı kuluçka makinesi
- Parkta gezen ve altın düşüren hayvanlar, doğaya salma
- "Yeni hayvan!" kutlaması ve elmas ödülü

Henüz olmayanlar: kayıt (oyun kapanınca sıfırlanır), yükseltmeler, besleme, yetenekler, koleksiyon defteri, reklamlar.
