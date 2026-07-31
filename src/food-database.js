// Ported from the existing NutriCore project rather than rebuilt. Boss's instruction from
// the start was to take the parts we already have working instead of starting over, and
// this table is one of them: 130 foods people in Taiwan actually eat, with the figures
// per 100 g or 100 ml, so someone can pick "滷肉飯" and a portion instead of being asked
// to know how many grams of carbohydrate were in it.
//
// Values are per 100 units. `defQty` is a typical serving where one is worth suggesting.

export const FOODS = [
  { name: '白飯', kcal: 183, carb: 41, protein: 3.0, fat: 0.3, fiber: 0.5, na: 1, unit: 'g' },
  { name: '糙米飯', kcal: 165, carb: 35, protein: 3.2, fat: 1.0, fiber: 1.8, na: 2, unit: 'g' },
  { name: '五穀飯', kcal: 170, carb: 36, protein: 4, fat: 1.2, fiber: 2.5, na: 3, unit: 'g' },
  { name: '麵條（熟）', kcal: 138, carb: 28, protein: 5, fat: 0.6, fiber: 1, na: 5, unit: 'g' },
  { name: '拉麵（熟）', kcal: 137, carb: 26, protein: 5, fat: 1.5, fiber: 1, na: 270, unit: 'g' },
  { name: '烏龍麵（熟）', kcal: 105, carb: 23, protein: 2.6, fat: 0.4, fiber: 0.8, na: 180, unit: 'g' },
  { name: '米粉（熟）', kcal: 110, carb: 25, protein: 1.8, fat: 0.2, fiber: 0.3, na: 2, unit: 'g' },
  { name: '冬粉（熟）', kcal: 98, carb: 24, protein: 0, fat: 0, fiber: 0, na: 3, unit: 'g' },
  { name: '白土司', kcal: 265, carb: 50, protein: 9, fat: 3, fiber: 2, na: 480, unit: 'g' },
  { name: '全麥吐司', kcal: 247, carb: 43, protein: 9, fat: 4, fiber: 5, na: 400, unit: 'g' },
  { name: '燕麥片', kcal: 389, carb: 67, protein: 17, fat: 7, fiber: 10, na: 2, unit: 'g' },
  { name: '薏仁（熟）', kcal: 127, carb: 28, protein: 4, fat: 1, fiber: 1, na: 2, unit: 'g' },
  { name: '地瓜（蒸）', kcal: 90, carb: 21, protein: 1.6, fat: 0.1, fiber: 3, na: 36, unit: 'g' },
  { name: '馬鈴薯（水煮）', kcal: 87, carb: 20, protein: 1.9, fat: 0.1, fiber: 1.8, na: 6, unit: 'g' },
  { name: '玉米（水煮）', kcal: 108, carb: 25, protein: 3.4, fat: 1.3, fiber: 2.4, na: 15, unit: 'g' },
  { name: '饅頭', kcal: 220, carb: 46, protein: 7, fat: 1, fiber: 1.5, na: 300, unit: 'g' },

  { name: '雞腿便當（炸）', kcal: 141.6, carb: 15.8, protein: 5.8, fat: 6.3, defQty: 600, unit: 'g' },
  { name: '雞腿便當（滷）', kcal: 125, carb: 15.0, protein: 5.8, fat: 4.2, defQty: 600, unit: 'g' },
  { name: '排骨便當（炸）', kcal: 150, carb: 16.7, protein: 5.0, fat: 7.0, defQty: 600, unit: 'g' },
  { name: '排骨便當（滷）', kcal: 133.3, carb: 15.8, protein: 5.0, fat: 5.5, defQty: 600, unit: 'g' },
  { name: '拿鐵咖啡（無糖）', kcal: 43, carb: 4.5, protein: 3.2, fat: 1.5, defQty: 360, unit: 'ml' },

  { name: '雞胸肉（熟）', kcal: 165, carb: 0, protein: 31, fat: 3.6, fiber: 0, na: 74, unit: 'g' },
  { name: '雞腿肉（去皮）', kcal: 179, carb: 0, protein: 25, fat: 9, fiber: 0, na: 87, unit: 'g' },
  { name: '雞翅', kcal: 222, carb: 0, protein: 19, fat: 16, fiber: 0, na: 75, unit: 'g' },
  { name: '豬里肌', kcal: 188, carb: 0, protein: 29, fat: 8, fiber: 0, na: 62, unit: 'g' },
  { name: '豬五花', kcal: 395, carb: 0, protein: 17, fat: 36, fiber: 0, na: 54, unit: 'g' },
  { name: '豬絞肉（半瘦）', kcal: 263, carb: 0, protein: 18, fat: 21, fiber: 0, na: 60, unit: 'g' },
  { name: '牛肉（瘦）', kcal: 158, carb: 0, protein: 26, fat: 6, fiber: 0, na: 65, unit: 'g' },
  { name: '牛絞肉（80/20）', kcal: 250, carb: 0, protein: 19, fat: 19, fiber: 0, na: 70, unit: 'g' },
  { name: '鴨肉（去皮）', kcal: 165, carb: 0, protein: 23, fat: 8, fiber: 0, na: 74, unit: 'g' },
  { name: '豬肝', kcal: 134, carb: 3.8, protein: 21, fat: 4, fiber: 0, na: 65, unit: 'g' },

  { name: '鮭魚', kcal: 208, carb: 0, protein: 20, fat: 13, fiber: 0, na: 59, unit: 'g' },
  { name: '鯛魚', kcal: 128, carb: 0, protein: 26, fat: 3, fiber: 0, na: 56, unit: 'g' },
  { name: '鮪魚（水漬罐）', kcal: 116, carb: 0, protein: 26, fat: 1, fiber: 0, na: 320, unit: 'g' },
  { name: '秋刀魚', kcal: 318, carb: 0, protein: 22, fat: 26, fiber: 0, na: 90, unit: 'g' },
  { name: '虱目魚', kcal: 162, carb: 0, protein: 22, fat: 8, fiber: 0, na: 65, unit: 'g' },
  { name: '蝦仁', kcal: 99, carb: 0.9, protein: 24, fat: 0.3, fiber: 0, na: 111, unit: 'g' },
  { name: '花枝/透抽', kcal: 82, carb: 1.5, protein: 18, fat: 1, fiber: 0, na: 200, unit: 'g' },
  { name: '文蛤', kcal: 64, carb: 3, protein: 12, fat: 1, fiber: 0, na: 490, unit: 'g' },
  { name: '牡蠣', kcal: 60, carb: 5, protein: 7, fat: 2, fiber: 0, na: 210, unit: 'g' },

  { name: '雞蛋（全蛋）', kcal: 155, carb: 1.1, protein: 13, fat: 11, fiber: 0, na: 124, unit: 'g' },
  { name: '水煮蛋', kcal: 155, carb: 1.1, protein: 13, fat: 11, fiber: 0, na: 124, defQty: 50, unit: 'g' },
  { name: '荷包蛋', kcal: 196, carb: 0.6, protein: 14, fat: 15, fiber: 0, na: 207, unit: 'g' },
  { name: '豆腐（板豆腐）', kcal: 76, carb: 1.9, protein: 8, fat: 4.2, fiber: 0.3, na: 7, unit: 'g' },
  { name: '嫩豆腐', kcal: 55, carb: 2, protein: 5.5, fat: 2.7, fiber: 0.2, na: 11, unit: 'g' },
  { name: '豆乾', kcal: 194, carb: 5, protein: 20, fat: 11, fiber: 0.5, na: 340, unit: 'g' },
  { name: '油豆腐', kcal: 145, carb: 2.5, protein: 12, fat: 10, fiber: 0.4, na: 5, unit: 'g' },
  { name: '百頁豆腐', kcal: 215, carb: 5, protein: 13, fat: 16, fiber: 0, na: 420, unit: 'g' },
  { name: '黃豆（熟）', kcal: 173, carb: 10, protein: 17, fat: 9, fiber: 6, na: 2, unit: 'g' },
  { name: '毛豆', kcal: 122, carb: 8.4, protein: 12, fat: 5.4, fiber: 4.2, na: 9, unit: 'g' },
  { name: '紅豆（熟）', kcal: 127, carb: 25, protein: 7.6, fat: 0.5, fiber: 5.5, na: 4, unit: 'g' },
  { name: '綠豆（熟）', kcal: 105, carb: 19, protein: 7.6, fat: 0.4, fiber: 4.1, na: 5, unit: 'g' },

  { name: '鮮奶（全脂）', kcal: 61, carb: 4.8, protein: 3.2, fat: 3.2, fiber: 0, na: 44, unit: 'ml' },
  { name: '低脂牛奶', kcal: 46, carb: 4.7, protein: 3.3, fat: 1.5, fiber: 0, na: 44, unit: 'ml' },
  { name: '無糖優格', kcal: 59, carb: 3.6, protein: 10, fat: 0.4, fiber: 0, na: 46, unit: 'g' },
  { name: '希臘優格', kcal: 97, carb: 3.6, protein: 10, fat: 5, fiber: 0, na: 35, unit: 'g' },
  { name: '起司片', kcal: 339, carb: 2, protein: 25, fat: 26, fiber: 0, na: 620, unit: 'g' },
  { name: '豆漿（無糖）', kcal: 34, carb: 2.9, protein: 3.6, fat: 1, fiber: 0.2, na: 40, unit: 'ml' },
  { name: '豆漿（微糖）', kcal: 58, carb: 8, protein: 3.6, fat: 1.2, fiber: 0.2, na: 55, unit: 'ml' },

  { name: '花椰菜', kcal: 25, carb: 5, protein: 1.9, fat: 0.3, fiber: 2.4, na: 30, unit: 'g' },
  { name: '菠菜', kcal: 23, carb: 3.6, protein: 2.9, fat: 0.4, fiber: 2.2, na: 79, unit: 'g' },
  { name: '高麗菜', kcal: 25, carb: 5.8, protein: 1.3, fat: 0.1, fiber: 2.5, na: 18, unit: 'g' },
  { name: '小白菜', kcal: 15, carb: 2.2, protein: 1.5, fat: 0.2, fiber: 1.4, na: 40, unit: 'g' },
  { name: '空心菜', kcal: 19, carb: 3.1, protein: 1.8, fat: 0.2, fiber: 2.1, na: 73, unit: 'g' },
  { name: '韭菜', kcal: 27, carb: 4.6, protein: 2.1, fat: 0.4, fiber: 2.7, na: 12, unit: 'g' },
  { name: '番茄', kcal: 18, carb: 3.9, protein: 0.9, fat: 0.2, fiber: 1.2, na: 5, unit: 'g' },
  { name: '小黃瓜', kcal: 15, carb: 3.6, protein: 0.7, fat: 0.1, fiber: 0.5, na: 2, unit: 'g' },
  { name: '茄子', kcal: 25, carb: 5.5, protein: 1.1, fat: 0.2, fiber: 3, na: 2, unit: 'g' },
  { name: '洋蔥', kcal: 40, carb: 9.3, protein: 1, fat: 0.1, fiber: 1.7, na: 4, unit: 'g' },
  { name: '紅蘿蔔', kcal: 37, carb: 8.7, protein: 0.9, fat: 0.1, fiber: 2.8, na: 69, unit: 'g' },
  { name: '南瓜', kcal: 26, carb: 6.5, protein: 1, fat: 0.1, fiber: 0.5, na: 1, unit: 'g' },
  { name: '豆芽菜', kcal: 30, carb: 6, protein: 3.1, fat: 0.2, fiber: 1.8, na: 6, unit: 'g' },
  { name: '苦瓜', kcal: 20, carb: 4.3, protein: 0.9, fat: 0.2, fiber: 2.6, na: 5, unit: 'g' },
  { name: '芹菜', kcal: 16, carb: 2.8, protein: 1.2, fat: 0.2, fiber: 1.6, na: 80, unit: 'g' },
  { name: '蘑菇', kcal: 22, carb: 3.3, protein: 3.1, fat: 0.3, fiber: 1, na: 5, unit: 'g' },
  { name: '金針菇', kcal: 37, carb: 7.4, protein: 2.7, fat: 0.3, fiber: 2.7, na: 7, unit: 'g' },
  { name: '香菇', kcal: 34, carb: 6.8, protein: 2.2, fat: 0.5, fiber: 3.5, na: 9, unit: 'g' },

  { name: '香蕉', kcal: 89, carb: 23, protein: 1.1, fat: 0.3, fiber: 2.6, na: 1, unit: 'g' },
  { name: '蘋果', kcal: 52, carb: 14, protein: 0.3, fat: 0.2, fiber: 2.4, na: 1, unit: 'g' },
  { name: '芭樂', kcal: 68, carb: 14, protein: 2.6, fat: 1, fiber: 5.4, na: 2, unit: 'g' },
  { name: '葡萄', kcal: 69, carb: 18, protein: 0.7, fat: 0.2, fiber: 0.9, na: 2, unit: 'g' },
  { name: '橘子', kcal: 47, carb: 12, protein: 0.9, fat: 0.1, fiber: 2.4, na: 0, unit: 'g' },
  { name: '西瓜', kcal: 30, carb: 7.6, protein: 0.6, fat: 0.2, fiber: 0.4, na: 1, unit: 'g' },
  { name: '鳳梨', kcal: 50, carb: 13, protein: 0.5, fat: 0.1, fiber: 1.4, na: 1, unit: 'g' },
  { name: '木瓜', kcal: 39, carb: 9.8, protein: 0.6, fat: 0.1, fiber: 1.8, na: 8, unit: 'g' },
  { name: '芒果', kcal: 66, carb: 17, protein: 0.6, fat: 0.4, fiber: 1.6, na: 1, unit: 'g' },
  { name: '水梨', kcal: 50, carb: 13, protein: 0.3, fat: 0.1, fiber: 3.1, na: 0, unit: 'g' },
  { name: '草莓', kcal: 32, carb: 7.7, protein: 0.7, fat: 0.3, fiber: 2, na: 1, unit: 'g' },
  { name: '藍莓', kcal: 57, carb: 14.5, protein: 0.7, fat: 0.3, fiber: 2.4, na: 1, unit: 'g' },
  { name: '哈密瓜', kcal: 34, carb: 8.2, protein: 0.8, fat: 0.1, fiber: 0.9, na: 16, unit: 'g' },
  { name: '荔枝', kcal: 66, carb: 17, protein: 0.8, fat: 0.4, fiber: 1.3, na: 1, unit: 'g' },

  { name: '蛋餅', kcal: 135, carb: 17, protein: 6.0, fat: 4.5, fiber: 0.5, na: 290, defQty: 200, unit: 'g' },
  { name: '燒餅（夾蛋）', kcal: 200, carb: 29, protein: 7.6, fat: 5.3, fiber: 0.8, na: 320, defQty: 170, unit: 'g' },
  { name: '油條', kcal: 373, carb: 43, protein: 9, fat: 18, fiber: 0.5, na: 640, unit: 'g' },
  { name: '包子（肉）', kcal: 167, carb: 25, protein: 7.5, fat: 4.2, fiber: 0.8, na: 317, defQty: 120, unit: 'g' },
  { name: '水餃（水煮）', kcal: 155, carb: 20, protein: 8.5, fat: 4.5, fiber: 0.5, na: 280, unit: 'g' },
  { name: '鍋貼', kcal: 195, carb: 21, protein: 9.0, fat: 8.0, fiber: 0.5, na: 340, unit: 'g' },
  { name: '割包', kcal: 172, carb: 24, protein: 7.2, fat: 5.0, fiber: 0.8, na: 306, defQty: 180, unit: 'g' },
  { name: '肉圓', kcal: 133, carb: 22, protein: 4.0, fat: 3.3, fiber: 0.3, na: 280, defQty: 150, unit: 'g' },
  { name: '碗粿', kcal: 120, carb: 25, protein: 3, fat: 1, fiber: 0.5, na: 380, unit: 'g' },
  { name: '臭豆腐（炸）', kcal: 185, carb: 6, protein: 14, fat: 12, fiber: 1, na: 480, unit: 'g' },
  { name: '蚵仔煎', kcal: 140, carb: 18, protein: 7, fat: 5, fiber: 1, na: 350, unit: 'g' },
  { name: '鹽酥雞', kcal: 320, carb: 15, protein: 22, fat: 19, fiber: 0.5, na: 680, unit: 'g' },
  { name: '茶葉蛋', kcal: 158, carb: 1.5, protein: 13, fat: 11, fiber: 0, na: 490, unit: 'g' },

  { name: '滷肉飯', kcal: 135, carb: 22, protein: 5.0, fat: 4.0, fiber: 0.5, na: 220, defQty: 300, unit: 'g' },
  { name: '排骨便當', kcal: 145, carb: 18, protein: 7.0, fat: 5.0, fiber: 0.8, na: 300, defQty: 550, unit: 'g' },
  { name: '雞腿便當', kcal: 140, carb: 17, protein: 8.0, fat: 5.0, fiber: 0.8, na: 310, defQty: 550, unit: 'g' },
  { name: '牛肉麵', kcal: 105, carb: 15, protein: 6.5, fat: 3.0, fiber: 0.5, na: 420, defQty: 500, unit: 'g' },
  { name: '炒飯', kcal: 155, carb: 22, protein: 4.5, fat: 5.5, fiber: 0.5, na: 320, unit: 'g' },
  { name: '炒麵', kcal: 125, carb: 18, protein: 4.0, fat: 4.5, fiber: 0.5, na: 290, unit: 'g' },
  { name: '咖哩飯', kcal: 115, carb: 19, protein: 4.0, fat: 3.5, fiber: 0.8, na: 280, unit: 'g' },
  { name: '義大利麵（紅醬）', kcal: 135, carb: 20, protein: 5.0, fat: 4.5, fiber: 0.8, na: 260, unit: 'g' },
  { name: '御飯糰（鮪魚）', kcal: 178, carb: 32, protein: 5.8, fat: 2.8, fiber: 0.5, na: 400, defQty: 110, unit: 'g' },

  { name: '珍珠奶茶', kcal: 66, carb: 13.6, protein: 0.4, fat: 1.2, fiber: 0, na: 16, defQty: 500, unit: 'ml' },
  { name: '拿鐵', kcal: 58, carb: 6.7, protein: 2.7, fat: 2.1, fiber: 0, na: 35, defQty: 330, unit: 'ml' },
  { name: '黑咖啡', kcal: 5, carb: 0, protein: 0.3, fat: 0.1, fiber: 0, na: 5, defQty: 330, unit: 'ml' },
  { name: '椰子水', kcal: 19, carb: 3.7, protein: 0.7, fat: 0.2, fiber: 0.3, na: 42, unit: 'ml' },
  { name: '柳橙汁（鮮榨）', kcal: 45, carb: 10, protein: 0.7, fat: 0.1, fiber: 0.2, na: 1, unit: 'ml' },
  { name: '運動飲料', kcal: 22, carb: 5.5, protein: 0, fat: 0, fiber: 0, na: 210, unit: 'ml' },
  { name: '可樂', kcal: 42, carb: 10.6, protein: 0, fat: 0, fiber: 0, na: 14, defQty: 330, unit: 'ml' },

  { name: '洋芋片', kcal: 536, carb: 55, protein: 7, fat: 33, fiber: 3.8, na: 525, unit: 'g' },
  { name: '黑巧克力（70%）', kcal: 598, carb: 46, protein: 8, fat: 43, fiber: 11, na: 20, unit: 'g' },
  { name: '堅果（綜合）', kcal: 600, carb: 20, protein: 15, fat: 52, fiber: 7, na: 3, unit: 'g' },
  { name: '蛋白棒', kcal: 220, carb: 22, protein: 20, fat: 6, fiber: 2, na: 180, unit: 'g' },
  { name: '米果', kcal: 367, carb: 82, protein: 7, fat: 1, fiber: 0.5, na: 380, unit: 'g' },
  { name: '蘇打餅乾', kcal: 432, carb: 70, protein: 9, fat: 13, fiber: 1, na: 680, unit: 'g' },
  { name: '仙貝', kcal: 367, carb: 82, protein: 7, fat: 1.5, fiber: 0.5, na: 350, unit: 'g' },
  { name: '爆米花（無奶油）', kcal: 375, carb: 74, protein: 11, fat: 5, fiber: 14.5, na: 8, unit: 'g' },
  { name: '豆花（無糖）', kcal: 45, carb: 8, protein: 3, fat: 0.5, fiber: 0, na: 5, unit: 'g' },

  // ── Everyday additions ──────────────────────────────────────────────
  // The first table covered ingredients well but thinned out on the things people
  // actually order: breakfast shops, convenience stores, night markets, home cooking.
  // Someone who ate 蘿蔔糕 and a 紅茶 should find both without having to translate the
  // meal into rice and oil first.
  { name: '稀飯／白粥', kcal: 46, carb: 10, protein: 0.9, fat: 0.1, fiber: 0.1, na: 2, defQty: 350, unit: 'g' },
  { name: '油飯', kcal: 195, carb: 28, protein: 5.5, fat: 6.5, fiber: 0.6, na: 380, defQty: 200, unit: 'g' },
  { name: '肉燥飯', kcal: 148, carb: 23, protein: 5.2, fat: 4.2, fiber: 0.5, na: 240, defQty: 300, unit: 'g' },
  { name: '陽春麵', kcal: 118, carb: 20, protein: 4.2, fat: 2.2, fiber: 0.6, na: 380, defQty: 450, unit: 'g' },
  { name: '乾麵', kcal: 175, carb: 24, protein: 5.5, fat: 6.0, fiber: 0.8, na: 420, defQty: 250, unit: 'g' },
  { name: '麻醬麵', kcal: 205, carb: 25, protein: 6.5, fat: 8.5, fiber: 1.0, na: 450, defQty: 250, unit: 'g' },
  { name: '餛飩麵', kcal: 115, carb: 16, protein: 6.0, fat: 3.0, fiber: 0.5, na: 400, defQty: 450, unit: 'g' },
  { name: '泡麵（含湯）', kcal: 108, carb: 14, protein: 2.5, fat: 4.5, fiber: 0.6, na: 480, defQty: 450, unit: 'g' },
  { name: '蘿蔔糕', kcal: 148, carb: 22, protein: 2.2, fat: 5.5, fiber: 0.8, na: 330, defQty: 150, unit: 'g' },
  { name: '薯餅', kcal: 265, carb: 28, protein: 3.0, fat: 15, fiber: 2.2, na: 400, defQty: 60, unit: 'g' },
  { name: '火腿蛋三明治', kcal: 232, carb: 24, protein: 10, fat: 10, fiber: 1.2, na: 480, defQty: 160, unit: 'g' },
  { name: '鮪魚三明治', kcal: 215, carb: 25, protein: 9.5, fat: 8.5, fiber: 1.2, na: 450, defQty: 160, unit: 'g' },
  { name: '漢堡（豬肉）', kcal: 248, carb: 24, protein: 11, fat: 12, fiber: 1.2, na: 460, defQty: 150, unit: 'g' },
  { name: '菠蘿麵包', kcal: 348, carb: 50, protein: 7, fat: 13, fiber: 1.5, na: 300, defQty: 90, unit: 'g' },
  { name: '奶酥麵包', kcal: 372, carb: 48, protein: 7, fat: 17, fiber: 1.3, na: 320, defQty: 90, unit: 'g' },
  { name: '蔥抓餅', kcal: 285, carb: 34, protein: 6, fat: 14, fiber: 1.2, na: 420, defQty: 120, unit: 'g' },
  { name: '關東煮（綜合）', kcal: 85, carb: 9, protein: 6, fat: 2.5, fiber: 0.8, na: 520, defQty: 250, unit: 'g' },
  { name: '甜不辣', kcal: 165, carb: 18, protein: 9, fat: 6, fiber: 0.5, na: 480, unit: 'g' },
  { name: '貢丸', kcal: 185, carb: 6, protein: 12, fat: 13, fiber: 0.2, na: 520, unit: 'g' },
  { name: '魚丸', kcal: 118, carb: 9, protein: 11, fat: 4, fiber: 0.2, na: 480, unit: 'g' },
  { name: '蟹肉棒', kcal: 95, carb: 12, protein: 7, fat: 1.5, fiber: 0, na: 560, unit: 'g' },
  { name: '貢丸湯', kcal: 52, carb: 2.5, protein: 3.5, fat: 3.2, fiber: 0.1, na: 320, defQty: 300, unit: 'g' },
  { name: '味噌湯', kcal: 32, carb: 3.0, protein: 2.2, fat: 1.2, fiber: 0.4, na: 380, defQty: 300, unit: 'g' },
  { name: '蛤蜊湯', kcal: 28, carb: 1.5, protein: 3.8, fat: 0.6, fiber: 0.1, na: 340, defQty: 300, unit: 'g' },
  { name: '紫菜蛋花湯', kcal: 35, carb: 2.2, protein: 2.6, fat: 1.6, fiber: 0.4, na: 350, defQty: 300, unit: 'g' },
  { name: '番茄炒蛋', kcal: 118, carb: 5.0, protein: 6.5, fat: 8.0, fiber: 0.9, na: 320, defQty: 200, unit: 'g' },
  { name: '麻婆豆腐', kcal: 135, carb: 6.0, protein: 8.0, fat: 9.0, fiber: 0.8, na: 480, defQty: 200, unit: 'g' },
  { name: '三杯雞', kcal: 205, carb: 6.5, protein: 18, fat: 12, fiber: 0.4, na: 520, defQty: 200, unit: 'g' },
  { name: '紅燒肉', kcal: 295, carb: 5.5, protein: 15, fat: 24, fiber: 0.3, na: 480, defQty: 150, unit: 'g' },
  { name: '滷蛋', kcal: 158, carb: 2.5, protein: 12.5, fat: 11, fiber: 0, na: 420, defQty: 55, unit: 'g' },
  { name: '滷豆干', kcal: 175, carb: 6.5, protein: 17, fat: 9.5, fiber: 0.6, na: 520, unit: 'g' },
  { name: '白菜滷', kcal: 62, carb: 5.5, protein: 2.4, fat: 3.5, fiber: 1.4, na: 340, defQty: 200, unit: 'g' },
  { name: '燙青菜', kcal: 45, carb: 3.5, protein: 1.8, fat: 2.6, fiber: 2.0, na: 220, defQty: 150, unit: 'g' },
  { name: '滷白菜', kcal: 58, carb: 5.0, protein: 2.0, fat: 3.2, fiber: 1.5, na: 320, defQty: 200, unit: 'g' },
  { name: '青江菜', kcal: 16, carb: 2.4, protein: 1.6, fat: 0.2, fiber: 1.6, na: 65, unit: 'g' },
  { name: '大白菜', kcal: 13, carb: 2.2, protein: 1.1, fat: 0.2, fiber: 1.0, na: 20, unit: 'g' },
  { name: '絲瓜', kcal: 17, carb: 3.9, protein: 0.9, fat: 0.1, fiber: 1.0, na: 3, unit: 'g' },
  { name: '冬瓜', kcal: 13, carb: 3.0, protein: 0.4, fat: 0.1, fiber: 0.9, na: 2, unit: 'g' },
  { name: '玉米筍', kcal: 31, carb: 6.4, protein: 2.4, fat: 0.3, fiber: 2.3, na: 5, unit: 'g' },
  { name: '秋葵', kcal: 33, carb: 7.0, protein: 1.9, fat: 0.2, fiber: 3.2, na: 7, unit: 'g' },
  { name: '青椒', kcal: 20, carb: 4.6, protein: 0.9, fat: 0.2, fiber: 1.7, na: 3, unit: 'g' },
  { name: '白蘿蔔', kcal: 18, carb: 4.0, protein: 0.7, fat: 0.1, fiber: 1.3, na: 25, unit: 'g' },
  { name: '蓮霧', kcal: 35, carb: 8.4, protein: 0.5, fat: 0.2, fiber: 1.0, na: 5, unit: 'g' },
  { name: '釋迦', kcal: 104, carb: 26, protein: 2.2, fat: 0.3, fiber: 2.7, na: 4, unit: 'g' },
  { name: '火龍果', kcal: 51, carb: 12.3, protein: 0.9, fat: 0.3, fiber: 1.7, na: 3, unit: 'g' },
  { name: '柳丁', kcal: 43, carb: 11, protein: 0.8, fat: 0.2, fiber: 2.1, na: 2, unit: 'g' },
  { name: '棗子', kcal: 46, carb: 11, protein: 0.8, fat: 0.2, fiber: 1.7, na: 3, unit: 'g' },
  { name: '柚子', kcal: 38, carb: 9.6, protein: 0.7, fat: 0.2, fiber: 1.2, na: 2, unit: 'g' },
  { name: '奇異果', kcal: 61, carb: 15, protein: 1.1, fat: 0.5, fiber: 3.0, na: 3, unit: 'g' },
  { name: '紅茶（無糖）', kcal: 1, carb: 0.2, protein: 0, fat: 0, fiber: 0, na: 3, defQty: 500, unit: 'ml' },
  { name: '綠茶（無糖）', kcal: 1, carb: 0.2, protein: 0, fat: 0, fiber: 0, na: 2, defQty: 500, unit: 'ml' },
  { name: '紅茶（微糖）', kcal: 28, carb: 7.0, protein: 0, fat: 0, fiber: 0, na: 3, defQty: 500, unit: 'ml' },
  { name: '奶茶', kcal: 62, carb: 11, protein: 1.2, fat: 1.6, fiber: 0, na: 40, defQty: 500, unit: 'ml' },
  { name: '鮮奶茶', kcal: 58, carb: 8.5, protein: 2.2, fat: 2.0, fiber: 0, na: 42, defQty: 500, unit: 'ml' },
  { name: '米漿', kcal: 68, carb: 12, protein: 1.2, fat: 1.8, fiber: 0.3, na: 45, defQty: 350, unit: 'ml' },
  { name: '養樂多', kcal: 71, carb: 16.5, protein: 1.0, fat: 0.1, fiber: 0, na: 20, defQty: 100, unit: 'ml' },
  { name: '優酪乳（原味）', kcal: 72, carb: 12, protein: 2.9, fat: 1.2, fiber: 0, na: 45, defQty: 200, unit: 'ml' },
  { name: '無糖氣泡水', kcal: 0, carb: 0, protein: 0, fat: 0, fiber: 0, na: 2, defQty: 500, unit: 'ml' },
  { name: '芋圓／地瓜圓', kcal: 178, carb: 42, protein: 0.8, fat: 0.2, fiber: 0.8, na: 12, defQty: 120, unit: 'g' },
  { name: '紅豆湯', kcal: 88, carb: 19, protein: 2.6, fat: 0.3, fiber: 2.0, na: 12, defQty: 300, unit: 'g' },
  { name: '綠豆湯', kcal: 72, carb: 16, protein: 2.2, fat: 0.2, fiber: 1.6, na: 10, defQty: 300, unit: 'g' },
  { name: '鹹酥雞（雞排）', kcal: 285, carb: 14, protein: 20, fat: 17, fiber: 0.4, na: 620, defQty: 200, unit: 'g' },
  { name: '滷味（綜合）', kcal: 145, carb: 8, protein: 12, fat: 7.5, fiber: 1.0, na: 640, defQty: 250, unit: 'g' },
  { name: '海苔', kcal: 178, carb: 12, protein: 30, fat: 2.5, fiber: 25, na: 800, unit: 'g' },
  { name: '鯖魚', kcal: 262, carb: 0, protein: 20, fat: 20, fiber: 0, na: 78, unit: 'g' },
  { name: '吳郭魚', kcal: 128, carb: 0, protein: 26, fat: 2.7, fiber: 0, na: 52, unit: 'g' },
  { name: '雞蛋豆腐', kcal: 88, carb: 2.5, protein: 6.5, fat: 5.8, fiber: 0.2, na: 220, unit: 'g' }
];

// ── 份量 ────────────────────────────────────────────────────────────────
// 「每 100 g 155 大卡」對一個只想記下今天吃了什麼的人是沒有用的：他知道自己吃了一顆蛋，
// 不知道那顆蛋幾克。所以常見份量寫在這裡當資料，介面只負責把它畫成可以點的按鈕——之後
// 要改份量、要加食物，都不必動介面。
//
// qty 用的是該食物自己的單位（g 或 ml），而且會連數字一起顯示在按鈕上：一碗是幾克講清楚，
// 覺得自己吃的比較多就直接改那個數字，不是給一個看不到根據的估計。
export const PORTION_SETS = {
  rice: [
    { en: 'half a bowl', zh: '半碗', qty: 100 },
    { en: 'a bowl', zh: '一碗', qty: 200 },
    { en: 'a large bowl', zh: '大碗', qty: 300 }
  ],
  porridge: [
    { en: 'a bowl', zh: '一碗', qty: 350 },
    { en: 'a large bowl', zh: '大碗', qty: 500 }
  ],
  noodles: [
    { en: 'half a portion', zh: '半份', qty: 100 },
    { en: 'a portion', zh: '一份', qty: 200 },
    { en: 'a large portion', zh: '大份', qty: 300 }
  ],
  soupNoodles: [
    { en: 'a bowl', zh: '一碗', qty: 450 },
    { en: 'a large bowl', zh: '大碗', qty: 600 }
  ],
  soup: [
    { en: 'a bowl', zh: '一碗', qty: 300 },
    { en: 'a large bowl', zh: '大碗', qty: 450 }
  ],
  egg: [
    { en: 'one egg', zh: '一顆', qty: 50 },
    { en: 'two eggs', zh: '兩顆', qty: 100 }
  ],
  bread: [
    { en: 'one slice', zh: '一片', qty: 30 },
    { en: 'two slices', zh: '兩片', qty: 60 }
  ],
  steamedBun: [
    { en: 'one', zh: '一個', qty: 100 },
    { en: 'two', zh: '兩個', qty: 200 }
  ],
  dumpling: [
    { en: 'five', zh: '五顆', qty: 100 },
    { en: 'ten', zh: '十顆', qty: 200 }
  ],
  meat: [
    { en: 'half a portion', zh: '半份', qty: 50 },
    { en: 'a palm-sized portion', zh: '一份（約手掌大）', qty: 100 },
    { en: 'two portions', zh: '兩份', qty: 200 }
  ],
  tofu: [
    { en: 'one block', zh: '一塊', qty: 80 },
    { en: 'two blocks', zh: '兩塊', qty: 160 }
  ],
  vegetable: [
    { en: 'half a bowl', zh: '半碗', qty: 50 },
    { en: 'a bowl', zh: '一碗', qty: 100 }
  ],
  fruit: [
    { en: 'a portion', zh: '一份', qty: 100 },
    { en: 'a bowl', zh: '一碗', qty: 150 }
  ],
  cheese: [
    { en: 'one slice', zh: '一片', qty: 20 },
    { en: 'two slices', zh: '兩片', qty: 40 }
  ],
  drink: [
    { en: 'a cup', zh: '一杯', qty: 250 },
    { en: 'a large cup', zh: '大杯', qty: 500 }
  ],
  snack: [
    { en: 'a small handful', zh: '一小把', qty: 25 },
    { en: 'a portion', zh: '一份', qty: 50 }
  ],
  plate: [
    { en: 'a small portion', zh: '小份', qty: 50 },
    { en: 'a portion', zh: '一份', qty: 100 },
    { en: 'a large portion', zh: '大份', qty: 200 }
  ]
};

// 哪些食物配哪一組。沒被列到的走 portionsFor 的預設，所以之後往表裡加東西也不會出現
// 「有食物、沒份量可點」的空欄。
const PORTION_RULES = [
  ['rice', ['白飯', '糙米飯', '五穀飯', '炒飯', '咖哩飯', '滷肉飯', '肉燥飯', '油飯']],
  ['porridge', ['稀飯／白粥']],
  ['noodles', ['麵條（熟）', '拉麵（熟）', '烏龍麵（熟）', '米粉（熟）', '冬粉（熟）', '炒麵', '乾麵', '麻醬麵', '義大利麵（紅醬）']],
  ['soupNoodles', ['牛肉麵', '陽春麵', '餛飩麵', '泡麵（含湯）']],
  ['soup', ['貢丸湯', '味噌湯', '蛤蜊湯', '紫菜蛋花湯', '紅豆湯', '綠豆湯']],
  ['egg', ['雞蛋（全蛋）', '水煮蛋', '荷包蛋', '茶葉蛋', '滷蛋']],
  ['bread', ['白土司', '全麥吐司']],
  ['steamedBun', ['饅頭']],
  ['dumpling', ['水餃（水煮）', '鍋貼']],
  ['meat', [
    '雞胸肉（熟）', '雞腿肉（去皮）', '雞翅', '豬里肌', '豬五花', '豬絞肉（半瘦）', '牛肉（瘦）',
    '牛絞肉（80/20）', '鴨肉（去皮）', '豬肝', '鮭魚', '鯛魚', '鮪魚（水漬罐）', '秋刀魚', '虱目魚',
    '蝦仁', '花枝/透抽', '文蛤', '牡蠣', '鯖魚', '吳郭魚'
  ]],
  ['tofu', ['豆腐（板豆腐）', '嫩豆腐', '豆乾', '油豆腐', '百頁豆腐', '滷豆干', '雞蛋豆腐']],
  ['vegetable', [
    '花椰菜', '菠菜', '高麗菜', '小白菜', '空心菜', '韭菜', '番茄', '小黃瓜', '茄子', '洋蔥',
    '紅蘿蔔', '南瓜', '豆芽菜', '苦瓜', '芹菜', '蘑菇', '金針菇', '香菇', '青江菜', '大白菜',
    '絲瓜', '冬瓜', '玉米筍', '秋葵', '青椒', '白蘿蔔'
  ]],
  ['fruit', [
    '香蕉', '蘋果', '芭樂', '葡萄', '橘子', '西瓜', '鳳梨', '木瓜', '芒果', '水梨', '草莓',
    '藍莓', '哈密瓜', '荔枝', '蓮霧', '釋迦', '火龍果', '柳丁', '棗子', '柚子', '奇異果'
  ]],
  ['cheese', ['起司片']],
  ['drink', ['鮮奶（全脂）', '低脂牛奶', '豆漿（無糖）', '豆漿（微糖）', '椰子水', '柳橙汁（鮮榨）', '運動飲料']],
  ['snack', ['洋芋片', '黑巧克力（70%）', '堅果（綜合）', '米果', '蘇打餅乾', '仙貝', '爆米花（無奶油）', '海苔']]
];

const PORTION_OF = new Map(
  PORTION_RULES.flatMap(([set, names]) => names.map((name) => [name, PORTION_SETS[set]]))
);

export function portionsFor(name) {
  const food = FOODS.find((entry) => entry.name === name);
  if (!food) return [];
  const named = PORTION_OF.get(name);
  if (named) return named;
  // 這道菜本身就帶著「一份是多少」（便當、飯糰、一杯飲料），那個才是最該先給的按鈕。
  if (food.defQty) {
    return [
      { en: 'half a serving', zh: '半份', qty: Math.round(food.defQty / 2) },
      { en: 'one serving', zh: '一份', qty: food.defQty }
    ];
  }
  return food.unit === 'ml' ? PORTION_SETS.drink : PORTION_SETS.plate;
}

// ── 英文與拼音別名 ──────────────────────────────────────────────────────
// 這份表的名字全是中文，所以打 rice 一個結果都出不來——對一個要送國際賽、預設語言是英文的
// 站來說，等於整個食物搜尋在英文介面下是壞的。別名寫在這裡，一個食物一行：英文名在前，
// 後面接拼音（分開寫也連起來寫，因為有人打 lurou、有人打 lu rou）。
export const FOOD_ALIASES = {
  '白飯': 'white rice bai fan baifan',
  '糙米飯': 'brown rice zaomi fan zao mi fan',
  '五穀飯': 'multigrain rice wugu fan wu gu fan',
  '麵條（熟）': 'noodles cooked mian tiao miantiao',
  '拉麵（熟）': 'ramen la mian lamian',
  '烏龍麵（熟）': 'udon noodles wulong mian wulongmian',
  '米粉（熟）': 'rice vermicelli mifen mi fen',
  '冬粉（熟）': 'glass noodles vermicelli dongfen dong fen',
  '白土司': 'white toast bread tusi tu si',
  '全麥吐司': 'wholemeal toast whole wheat bread quanmai tusi',
  '燕麥片': 'oats oatmeal yanmai pian yan mai',
  '薏仁（熟）': 'pearl barley job tears yiren yi ren',
  '地瓜（蒸）': 'sweet potato steamed digua di gua',
  '馬鈴薯（水煮）': 'potato boiled malingshu ma ling shu',
  '玉米（水煮）': 'corn sweetcorn boiled yumi yu mi',
  '饅頭': 'steamed bun mantou man tou',
  '雞腿便當（炸）': 'fried chicken leg bento lunchbox jitui biandang',
  '雞腿便當（滷）': 'braised chicken leg bento lunchbox jitui biandang',
  '排骨便當（炸）': 'fried pork chop bento lunchbox paigu biandang',
  '排骨便當（滷）': 'braised pork chop bento lunchbox paigu biandang',
  '拿鐵咖啡（無糖）': 'latte coffee unsweetened natie kafei',
  '雞胸肉（熟）': 'chicken breast cooked jixiong rou ji xiong',
  '雞腿肉（去皮）': 'chicken thigh skinless jitui rou ji tui',
  '雞翅': 'chicken wing jichi ji chi',
  '豬里肌': 'pork loin zhu liji li ji',
  '豬五花': 'pork belly zhu wuhua wu hua',
  '豬絞肉（半瘦）': 'minced pork ground pork zhu jiaorou jiao rou',
  '牛肉（瘦）': 'lean beef niurou niu rou',
  '牛絞肉（80/20）': 'minced beef ground beef niu jiaorou',
  '鴨肉（去皮）': 'duck skinless yarou ya rou',
  '豬肝': 'pork liver zhugan zhu gan',
  '鮭魚': 'salmon guiyu gui yu',
  '鯛魚': 'sea bream snapper diaoyu diao yu',
  '鮪魚（水漬罐）': 'tuna canned in water weiyu wei yu',
  '秋刀魚': 'pacific saury qiudaoyu qiu dao yu',
  '虱目魚': 'milkfish shimuyu shi mu yu',
  '蝦仁': 'shrimp prawn xiaren xia ren',
  '花枝/透抽': 'squid cuttlefish huazhi touchou',
  '文蛤': 'clam wenge wen ge',
  '牡蠣': 'oyster muli mu li',
  '雞蛋（全蛋）': 'egg whole egg jidan ji dan',
  '水煮蛋': 'boiled egg shuizhu dan shui zhu',
  '荷包蛋': 'fried egg sunny side hebao dan',
  '豆腐（板豆腐）': 'tofu firm bean curd doufu dou fu',
  '嫩豆腐': 'silken tofu soft nen doufu',
  '豆乾': 'dried tofu bean curd dougan dou gan',
  '油豆腐': 'fried tofu puff you doufu',
  '百頁豆腐': 'pressed tofu baiye doufu bai ye',
  '黃豆（熟）': 'soybeans cooked huangdou huang dou',
  '毛豆': 'edamame green soybeans maodou mao dou',
  '紅豆（熟）': 'red beans adzuki hongdou hong dou',
  '綠豆（熟）': 'mung beans lvdou lu dou',
  '鮮奶（全脂）': 'whole milk fresh xiannai xian nai',
  '低脂牛奶': 'low fat milk dizhi niunai',
  '無糖優格': 'plain yoghurt yogurt unsweetened wutang youge',
  '希臘優格': 'greek yoghurt yogurt xila youge',
  '起司片': 'cheese slice qisi pian qi si',
  '豆漿（無糖）': 'soy milk unsweetened soya doujiang dou jiang',
  '豆漿（微糖）': 'soy milk lightly sweetened soya doujiang',
  '花椰菜': 'broccoli cauliflower huayecai hua ye cai',
  '菠菜': 'spinach bocai bo cai',
  '高麗菜': 'cabbage gaolicai gao li cai',
  '小白菜': 'pak choi bok choy xiaobaicai',
  '空心菜': 'water spinach morning glory kongxincai',
  '韭菜': 'chives garlic chives jiucai jiu cai',
  '番茄': 'tomato fanqie fan qie',
  '小黃瓜': 'cucumber xiaohuanggua huanggua',
  '茄子': 'aubergine eggplant qiezi qie zi',
  '洋蔥': 'onion yangcong yang cong',
  '紅蘿蔔': 'carrot hongluobo luobo',
  '南瓜': 'pumpkin squash nangua nan gua',
  '豆芽菜': 'bean sprouts douyacai douya',
  '苦瓜': 'bitter gourd bitter melon kugua ku gua',
  '芹菜': 'celery qincai qin cai',
  '蘑菇': 'mushroom button mogu mo gu',
  '金針菇': 'enoki mushroom jinzhengu jin zhen gu',
  '香菇': 'shiitake mushroom xianggu xiang gu',
  '香蕉': 'banana xiangjiao xiang jiao',
  '蘋果': 'apple pingguo ping guo',
  '芭樂': 'guava bale ba le',
  '葡萄': 'grapes putao pu tao',
  '橘子': 'mandarin tangerine juzi ju zi',
  '西瓜': 'watermelon xigua xi gua',
  '鳳梨': 'pineapple fengli feng li',
  '木瓜': 'papaya mugua mu gua',
  '芒果': 'mango mangguo mang guo',
  '水梨': 'pear shuili shui li',
  '草莓': 'strawberry caomei cao mei',
  '藍莓': 'blueberry lanmei lan mei',
  '哈密瓜': 'cantaloupe melon hamigua ha mi gua',
  '荔枝': 'lychee litchi lizhi li zhi',
  '蛋餅': 'egg crepe pancake danbing dan bing',
  '燒餅（夾蛋）': 'sesame flatbread with egg shaobing shao bing',
  '油條': 'fried dough stick cruller youtiao you tiao',
  '包子（肉）': 'steamed pork bun baozi bao zi',
  '水餃（水煮）': 'boiled dumplings shuijiao jiaozi',
  '鍋貼': 'potstickers pan fried dumplings guotie guo tie',
  '割包': 'pork belly bun guabao gua bao',
  '肉圓': 'ba wan taiwanese meatball rouyuan rou yuan',
  '碗粿': 'savoury rice pudding wangui wan gui',
  '臭豆腐（炸）': 'stinky tofu fried choudoufu chou doufu',
  '蚵仔煎': 'oyster omelette ozaijian ke zai jian',
  '鹽酥雞': 'popcorn chicken fried yansuji yan su ji',
  '茶葉蛋': 'tea egg chaye dan cha ye',
  '滷肉飯': 'braised pork rice minced pork rice luroufan lu rou fan',
  '排骨便當': 'pork chop bento lunchbox paigu biandang',
  '雞腿便當': 'chicken leg bento lunchbox jitui biandang',
  '牛肉麵': 'beef noodle soup niuroumian niu rou mian',
  '炒飯': 'fried rice chaofan chao fan',
  '炒麵': 'fried noodles chaomian chao mian',
  '咖哩飯': 'curry rice galifan ga li fan',
  '義大利麵（紅醬）': 'pasta spaghetti tomato sauce yidali mian',
  '御飯糰（鮪魚）': 'rice ball onigiri tuna fantuan yufantuan',
  '珍珠奶茶': 'bubble tea boba milk tea zhenzhu naicha',
  '拿鐵': 'latte coffee natie na tie',
  '黑咖啡': 'black coffee americano hei kafei',
  '椰子水': 'coconut water yezi shui ye zi',
  '柳橙汁（鮮榨）': 'orange juice fresh liucheng zhi',
  '運動飲料': 'sports drink isotonic yundong yinliao',
  '可樂': 'cola coke kele ke le',
  '洋芋片': 'crisps potato chips yangyu pian',
  '黑巧克力（70%）': 'dark chocolate qiaokeli qiao ke li',
  '堅果（綜合）': 'mixed nuts jianguo jian guo',
  '蛋白棒': 'protein bar danbai bang',
  '米果': 'rice crackers miguo mi guo',
  '蘇打餅乾': 'crackers soda biscuits suda binggan',
  '仙貝': 'rice cracker senbei xianbei xian bei',
  '爆米花（無奶油）': 'popcorn plain baomihua bao mi hua',
  '豆花（無糖）': 'tofu pudding unsweetened douhua dou hua',
  '稀飯／白粥': 'congee rice porridge xifan baizhou',
  '油飯': 'glutinous rice youfan you fan',
  '肉燥飯': 'minced pork rice rouzao fan rou zao',
  '陽春麵': 'plain noodle soup yangchun mian',
  '乾麵': 'dry noodles ganmian gan mian',
  '麻醬麵': 'sesame paste noodles majiang mian',
  '餛飩麵': 'wonton noodles huntun mian',
  '泡麵（含湯）': 'instant noodles paomian pao mian',
  '蘿蔔糕': 'turnip cake radish cake luobo gao',
  '薯餅': 'hash brown shubing shu bing',
  '火腿蛋三明治': 'ham and egg sandwich huotui dan sanmingzhi',
  '鮪魚三明治': 'tuna sandwich weiyu sanmingzhi',
  '漢堡（豬肉）': 'pork burger hamburger hanbao han bao',
  '菠蘿麵包': 'pineapple bun boluo mianbao',
  '奶酥麵包': 'milk crumb bun naisu mianbao',
  '蔥抓餅': 'spring onion pancake scallion congzhua bing',
  '關東煮（綜合）': 'oden hotpot skewers guandongzhu',
  '甜不辣': 'tempura fishcake tianbula tian bu la',
  '貢丸': 'pork meatball gongwan gong wan',
  '魚丸': 'fish ball yuwan yu wan',
  '蟹肉棒': 'crab stick surimi xierou bang',
  '貢丸湯': 'pork meatball soup gongwan tang',
  '味噌湯': 'miso soup weizeng tang wei zeng',
  '蛤蜊湯': 'clam soup geli tang ge li',
  '紫菜蛋花湯': 'seaweed egg drop soup zicai danhua tang',
  '番茄炒蛋': 'tomato and egg fanqie chaodan',
  '麻婆豆腐': 'mapo tofu mapo doufu ma po',
  '三杯雞': 'three cup chicken sanbei ji san bei',
  '紅燒肉': 'braised pork belly hongshao rou',
  '滷蛋': 'braised egg soy egg ludan lu dan',
  '滷豆干': 'braised dried tofu lu dougan',
  '白菜滷': 'braised cabbage baicai lu',
  '燙青菜': 'blanched greens tang qingcai',
  '滷白菜': 'stewed cabbage lu baicai',
  '青江菜': 'pak choi bok choy qingjiang cai',
  '大白菜': 'napa cabbage chinese cabbage dabaicai',
  '絲瓜': 'loofah luffa squash sigua si gua',
  '冬瓜': 'winter melon donggua dong gua',
  '玉米筍': 'baby corn yumi sun',
  '秋葵': 'okra qiukui qiu kui',
  '青椒': 'green pepper capsicum bell pepper qingjiao',
  '白蘿蔔': 'daikon white radish bailuobo luobo',
  '蓮霧': 'wax apple lianwu lian wu',
  '釋迦': 'sugar apple custard apple shijia shi jia',
  '火龍果': 'dragon fruit pitaya huolongguo',
  '柳丁': 'orange liuding liu ding',
  '棗子': 'jujube indian date zaozi zao zi',
  '柚子': 'pomelo youzi you zi',
  '奇異果': 'kiwi kiwifruit qiyiguo qi yi guo',
  '紅茶（無糖）': 'black tea unsweetened hongcha hong cha',
  '綠茶（無糖）': 'green tea unsweetened lvcha lu cha',
  '紅茶（微糖）': 'black tea lightly sweetened hongcha',
  '奶茶': 'milk tea naicha nai cha',
  '鮮奶茶': 'fresh milk tea xiannai cha',
  '米漿': 'rice milk mijiang mi jiang',
  '養樂多': 'yakult fermented milk drink yangleduo',
  '優酪乳（原味）': 'drinking yoghurt yogurt plain youlaoru',
  '無糖氣泡水': 'sparkling water unsweetened qipao shui',
  '芋圓／地瓜圓': 'taro balls sweet potato balls yuyuan diguayuan',
  '紅豆湯': 'red bean soup hongdou tang',
  '綠豆湯': 'mung bean soup lvdou tang',
  '鹹酥雞（雞排）': 'fried chicken cutlet xiansuji jipai',
  '滷味（綜合）': 'braised snacks luwei lu wei',
  '海苔': 'seaweed nori haitai hai tai',
  '鯖魚': 'mackerel qingyu qing yu',
  '吳郭魚': 'tilapia wuguoyu wu guo yu',
  '雞蛋豆腐': 'egg tofu jidan doufu'
};

// 中文照原本的比對法，英文與拼音走別名。排序把「比較像在找這個」的排前面：名字整個一樣、
// 名字開頭、名字中間，然後才是別名的整個字、別名的字開頭、別名的任何位置。
function matchScore(food, term, needle) {
  if (food.name === term) return 0;
  if (food.name.startsWith(term)) return 1;
  if (food.name.includes(term)) return 2;
  const alias = FOOD_ALIASES[food.name];
  if (alias) {
    const words = alias.split(' ');
    if (words.includes(needle)) return 3;
    if (words.some((word) => word.startsWith(needle))) return 4;
    if (alias.includes(needle)) return 5;
  }
  // 人講話的字序跟資料庫命名不一樣：搜「滷雞腿」找不到「雞腿便當（滷）」，
  // 因為連續子字串比對要求字連在一起。最後退一步用字符覆蓋——查詢的每個中文字
  // 都出現在名字裡就算候選，排在所有子字串命中之後。兩個字以上才啟用，
  // 單字查詢上面的 includes 本來就會中，用覆蓋只會撈進一堆雜訊。
  const cjk = [...term].filter((ch) => /\p{Script=Han}/u.test(ch));
  if (cjk.length >= 2 && cjk.every((ch) => food.name.includes(ch))) return 6;
  return null;
}

export function searchFoods(query, limit = 8) {
  const term = String(query || '').trim();
  if (!term) return [];
  const needle = term.toLowerCase();
  const hits = [];
  FOODS.forEach((food, order) => {
    const score = matchScore(food, term, needle);
    if (score === null) return;
    hits.push({ food, score, order });
  });
  hits.sort((a, b) => a.score - b.score || a.order - b.order);
  // 份量跟著食物一起送出去，介面才不必自己記一份對照表（記了就會兩份長歪）。
  return hits.slice(0, limit).map(({ food }) => ({ ...food, portions: portionsFor(food.name) }));
}

// Figures are per 100 units, so a portion is a straight proportion. Rounded to one decimal
// because a home entry carrying more precision than that would be pretending.
export function nutritionFor(name, quantity) {
  const food = FOODS.find((entry) => entry.name === name);
  const amount = Number(quantity);
  if (!food || !Number.isFinite(amount) || amount <= 0) return null;
  const factor = amount / 100;
  const round = (value) => Math.round(value * factor * 10) / 10;
  return {
    name: food.name,
    quantity: amount,
    unit: food.unit,
    kcal: round(food.kcal),
    carbG: round(food.carb),
    proteinG: round(food.protein),
    fatG: round(food.fat)
  };
}
