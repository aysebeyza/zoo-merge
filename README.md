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
| `src/game/variant.ts` | Yumurta çeşidi: normal ya da nadir parlak (✨) |
| `src/game/fruit-merge.ts` | Meyve birleştirme mini oyununun kuralları ve fiziği |
| `src/game/state.ts` | Oyun durumu ve tüm hamleler (yumurta alma, birleştirme, kuluçka, park, yükseltmeler) |
| `src/game/save.ts` | Kaydı yazıya çevirme ve geri okuma |
| `src/hooks/` | Kaydı telefona yazan ve açılışta yükleyen kod |
| `src/components/` | Ekran parçaları: yumurta, park, kuluçka makinesi, üst bilgi çubuğu |
| `src/app/` | Ekranlar (Expo Router) |

Oyunun dengesini değiştirmek için çoğu zaman yalnızca `src/game/config.ts` dosyasını düzenlemek yeterli.

## Şu an oyunda olanlar

- 4x3 birleştirme alanı, sürükle-bırak ile birleştirme
- Her hayvanın yumurtası hep aynı renk (civciv sarı, kedi turuncu ...); nadir parlak (✨) yumurta %50 fazla kazandırır, birleşince parlaklık korunur
- 2 yuvalı kuluçka makinesi
- Parkta gezen ve altın düşüren hayvanlar, doğaya salma
- "Yeni hayvan!" kutlaması ve elmas ödülü
- Kayıt: oyun telefona kaydedilir, kapanıp açılınca kaldığı yerden devam eder
- Oyun kapalıyken en fazla 2 saatlik altın birikir, dönünce "Tekrar hoş geldin!" ekranı çıkar
- 6 yükseltme: otomatik yumurta, daha çok ziyaretçi, kuluçka makinesi, yeni kuluçka yuvası, daha iyi yumurta, daha büyük park
- Besleme: tokluk zamanla azalır, aç hayvan daha az kazanır. Her hayvanın kendi yemi var (civciv tohum, tavşan havuç ...); yemler yem dükkanından alınıp stokta durur, bir yem hayvanı tamamen doyurur. Uzun süre aç kalan hayvan kendi yumurtasına döner; alan doluysa yumurta hediye kutusunda (🎁) bekler.
- Hayvanlarım ekranı (parktaki 🐾 düğmesi): bütün hayvanlar tek tek, en aç olan en üstte; her hayvanın ne zaman acıkacağı yazar ("⏰ 1 sa sonra acıkır", "🍖 Şimdi besle!"); besle, yetenek geliştir, doğaya sal. İkinci sekmede yem dükkanı: her yemin parkta kaç hayvan için gerektiği ve stoğu, "Eksikleri al" ile her hayvana birer yem.
- Yetenekler: her hayvanın 3 seviyeli yeteneği (Sevimlilik, Gösteri, Görkem, Kral). Seviyeler parkta kalma süresiyle açılır, hayvanın kendi kazancına göre altınla geliştirilir; üzgün hayvanda çalışmaz, kaçan hayvanın yumurtası seviyeyi korur.
- Mini oyun: kuluçkadaki yumurtanın yanındaki "🍉 Oyna" ile 30 saniyelik meyve birleştirme oyunu; puana göre kalan kuluçka süresi %10-30 kısalır, her yumurta için bir kez (`src/game/fruit-merge.ts`, fizik: matter-js).
- Yumurtalar SVG ile çizilir: yumurta şekli, yarı saydam kabuk, içinde silik hayvan.

Henüz olmayanlar: koleksiyon defteri, reklamlar.

Kararlar:
- Parkta birleştirme yapılmayacak: park dolunca yer açmanın yolu hayvanı doğaya salmak.
- Otomatik yemlik ve toplu besleyen mama kabı kaldırıldı: hayvanlar tek tek, kendi yemleriyle beslenir. Yemliği almış eski kayıtlara 250 altın iade edilir.
- Renk karışımı (saf / desenli haller) kaldırıldı: yumurta rengi hayvanı gösterir, çeşit olarak yalnızca parlak yumurta var. Eski kayıtlardaki desenliler parlak olur.

## Sonra yapılacaklar

- Hayvan görselleri: emojiler yerine gerçek çizimler; tokluğa göre farklı yüz ifadeleri (mutlu, acıkmış, üzgün).

Yükseltme fiyatları, seviye sayıları, besleme süreleri, yem fiyatları ve parlak yumurta şansı dokümanda yoktu; `src/game/config.ts` içindeki değerler öneridir, testlerde ayarlanacak.
