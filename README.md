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
| `src/game/state.ts` | Oyun durumu ve tüm hamleler (yumurta alma, birleştirme, kuluçka, park, yükseltmeler) |
| `src/game/save.ts` | Kaydı yazıya çevirme ve geri okuma |
| `src/hooks/` | Kaydı telefona yazan ve açılışta yükleyen kod |
| `src/components/` | Ekran parçaları: yumurta, park, kuluçka makinesi, üst bilgi çubuğu |
| `src/app/` | Ekranlar (Expo Router) |

Oyunun dengesini değiştirmek için çoğu zaman yalnızca `src/game/config.ts` dosyasını düzenlemek yeterli.

## Şu an oyunda olanlar

- 4x3 birleştirme alanı, sürükle-bırak ile birleştirme
- Renk karışımı (kırmızı + mavi = mor, saf ve desenli haller)
- 2 yuvalı kuluçka makinesi
- Parkta gezen ve altın düşüren hayvanlar, doğaya salma
- "Yeni hayvan!" kutlaması ve elmas ödülü
- Kayıt: oyun telefona kaydedilir, kapanıp açılınca kaldığı yerden devam eder
- Oyun kapalıyken en fazla 2 saatlik altın birikir, dönünce "Tekrar hoş geldin!" ekranı çıkar
- 7 yükseltme: otomatik yumurta, otomatik yemlik, daha çok ziyaretçi, kuluçka makinesi, yeni kuluçka yuvası, daha iyi yumurta, daha büyük park
- Besleme: tokluk zamanla azalır, aç hayvan daha az kazanır; mama kabı (🥣) altınla doyurur. Uzun süre aç kalan hayvan kendi yumurtasına döner; alan doluysa yumurta hediye kutusunda (🎁) bekler.

- Yetenekler: her hayvanın 3 seviyeli yeteneği (Sevimlilik, Gösteri, Görkem, Kral). Seviyeler parkta kalma süresiyle açılır, hayvanın kendi kazancına göre altınla geliştirilir; üzgün hayvanda çalışmaz, kaçan hayvanın yumurtası seviyeyi korur.

Henüz olmayanlar: koleksiyon defteri, parkta birleştirme, reklamlar.

Yükseltme fiyatları, seviye sayıları ve besleme süreleriyle mama fiyatı dokümanda yoktu; `src/game/config.ts` içindeki değerler öneridir, testlerde ayarlanacak.
