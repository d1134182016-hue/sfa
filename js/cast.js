export const FACTIONS = ['學生會', '絕對中立委員會', '一般學生'];

export const CAST = [
  {
    id: 'kirari', name: '桃喰綺羅莉', init: '綺', cls: 'kirari', faction: '學生會',
    title: '學生會長', grade: '三年級', blood: 'AB', birthday: '11 月 3 日',
    tags: ['會長', '賭徒', '規則制定者'],
    quote: '「這個學園的規則是我寫的。你可以贏，但要先學會不要怕輸。」',
    bio: '百花王學園學生會長，把整個學園當成一場巨大的賭局。她不在乎錢，只在乎對手在最後一刻露出什麼表情。家畜制度、公式戰與上納金，都是她默許的遊戲規則。'
  },
  {
    id: 'sayaka', name: '五十嵐清華', init: '嵐', cls: 'sayaka', faction: '學生會',
    title: '學生會書記', grade: '三年級', blood: 'A', birthday: '1 月 9 日',
    tags: ['書記', '會計', '會長直屬'],
    quote: '「會長的規矩，就是學生會的規矩。帳目我會一筆一筆對清楚。」',
    bio: '學生會書記，負責契約、名冊與所有帳目。她對桃喰綺羅莉近乎信仰，辦事精準到不近人情。入會測驗的規則書與家畜契約，都是她親手遞出去的。'
  },
  {
    id: 'yumemi', name: '夢見弓優芽美', init: '夢', cls: 'yumemi', faction: '學生會',
    title: '宣傳委員長 · 校園偶像', grade: '二年級', blood: 'O', birthday: '6 月 6 日',
    tags: ['偶像', '宣傳', '舞台'],
    quote: '「舞台上的笑容是免費的。門票，才是真正的賭注——你買了票，就得看完我贏。」',
    bio: '校園偶像，也是宣傳委員長。她懂得怎麼把一場普通的賭局包裝成萬人矚目的表演。笑容、燈光與話術都是她的牌，輸贏反而排在後面。'
  },
  {
    id: 'yuriko', name: '西洞院百合子', init: '西', cls: 'yuriko', faction: '學生會',
    title: '文化委員長', grade: '三年級', blood: 'B', birthday: '3 月 21 日',
    tags: ['文化委員', '生贄', '儀式'],
    quote: '「生贄的價值，在於她相信自己還能贏。」',
    bio: '文化委員長，迷戀「生贄」這個概念。她會把對手捧到高處，再讓對方自己走下來。看似溫柔的語氣，往往是最鋒利的一刀。'
  },
  {
    id: 'midari', name: '生志摩妄', init: '生', cls: 'midari', faction: '學生會',
    title: '美化委員長', grade: '三年級', blood: 'O', birthday: '9 月 2 日',
    tags: ['美化委員', '危險', '痛覺'],
    quote: '「贏或輸都無所謂。我想看的，是你把命押上去的表情。」',
    bio: '美化委員長，對疼痛與刺激的執著遠超過金錢。她會故意把自己逼到絕境，只為了看對手在最後一秒動搖。與她對局，最好先確認自己還想活著離開。'
  },
  {
    id: 'kaede', name: '豆生田楓', init: '豆', cls: 'kaede', faction: '學生會',
    title: '學生會會計', grade: '三年級', blood: 'A', birthday: '8 月 8 日',
    tags: ['會計', '機率', '冷靜'],
    quote: '「機率不會說謊。你輸，是因為你從一開始就算錯了。」',
    bio: '學生會會計，習慣把一切都換算成期望值。他不相信氣勢，只相信數字；而數字通常站在他那邊。據說他從未在沒有計算過的情況下坐上牌桌。'
  },
  {
    id: 'runa', name: '黄泉月露娜', init: '黄', cls: 'runa', faction: '絕對中立委員會',
    title: '絕對中立委員會議長', grade: '二年級', blood: 'B', birthday: '2 月 14 日',
    tags: ['中立', '審查', '紀錄'],
    quote: '「中立不是善意，是還沒有人給他們足夠的理由。」',
    bio: '絕對中立委員會議長。她不管學生會怎麼收錢，只要求帳目對得上。審查度累積到上限時，她會帶著委員會出現在學生會室門口，把校庫凍結一半。'
  },
  {
    id: 'mitsuyo', name: '陰喰三欲', init: '陰', cls: 'mitsuyo', faction: '絕對中立委員會',
    title: '中立委員', grade: '二年級', blood: 'AB', birthday: '5 月 5 日',
    tags: ['中立委員', '觀察', '沉默'],
    quote: '「我只看，不選邊。看久了，自然知道誰會先倒下。」',
    bio: '絕對中立委員會委員，負責旁聽學生會的所有會議。她很少開口，但每次開口都精準命中帳目裡最難看的那一行。'
  },
  {
    id: 'miri', name: '陽喰三理', init: '陽', cls: 'miri', faction: '絕對中立委員會',
    title: '中立委員', grade: '二年級', blood: 'O', birthday: '5 月 5 日',
    tags: ['中立委員', '談判', '笑容'],
    quote: '「規矩是死的，人是活的。可惜，帳也是活的。」',
    bio: '絕對中立委員會委員，負責與學生會協商。她總是把話說得很好聽，然後在最後一行加上一條誰都沒注意到的但書。'
  },
  {
    id: 'erine', name: '虫喰恵利音', init: '虫', cls: 'erine', faction: '絕對中立委員會',
    title: '中立委員會監察', grade: '一年級', blood: 'A', birthday: '7 月 7 日',
    tags: ['監察', '細節', '帳目'],
    quote: '「一筆帳錯了，整本帳都不能信。」',
    bio: '絕對中立委員會監察，負責抽查家畜名冊與繳納金紀錄。她會把每一枚硬幣的流向問到底，是學生會最不想在走廊上遇到的人。'
  },
  {
    id: 'yumeko', name: '蛇喰夢子', init: '夢', cls: 'yumeko', faction: '一般學生',
    title: '轉學生 · 賭博狂', grade: '二年級', blood: 'O', birthday: '12 月 24 日',
    tags: ['轉學生', '賭博狂', '不可預測'],
    quote: '「輸錢不可怕喔。可怕的是，你還沒真正愛上賭博。」',
    bio: '轉學生，對賭博的狂熱近乎病態。她不在乎輸贏，只在乎風險帶來的顫抖。沒有人知道她到底有多少錢，因為她從不把錢當成終點。'
  },
  {
    id: 'mary', name: '早乙女芽亞里', init: '芽', cls: 'mary', faction: '一般學生',
    title: '一般學生 · 前家畜', grade: '二年級', blood: 'A', birthday: '4 月 4 日',
    tags: ['前家畜', '現實派', '不服輸'],
    quote: '「被寫進家畜名冊不可怕。可怕的是，你習慣了那個名字。」',
    bio: '曾經是家畜，靠自己的牌技爬回普通學生的位子。她講話刻薄，卻比誰都清楚名冊上的名字是怎麼被劃掉的。對你而言，她是最不像朋友的幫手。'
  },
  {
    id: 'ryota', name: '鈴井涼太', init: '鈴', cls: 'ryota', faction: '一般學生',
    title: '家畜名冊', grade: '二年級', blood: 'A', birthday: '10 月 10 日',
    tags: ['家畜', '情報', '老實'],
    quote: '「我查過了。只要還清一千萬，契約就會解除。」',
    bio: '老實的普通學生，也是名冊上最常見的那種名字。他會幫你查規則、抄名單、記時間，代價只是偶爾借他一點籌碼。'
  },
  {
    id: 'mira', name: '骨喰ミラス', init: '骨', cls: 'mira', faction: '一般學生',
    title: '家畜名冊', grade: '一年級', blood: 'B', birthday: '1 月 1 日',
    tags: ['家畜', '觀察', '沉默'],
    quote: '「名冊上的名字，比牌桌上的籌碼還便宜。」',
    bio: '沉默的學生，習慣坐在牌桌最角落的位置。她記得每個人的欠款，也記得每個人最後一次還錢是哪一天。'
  },
  {
    id: 'nozomi', name: '狛喰希', init: '狛', cls: 'nozomi', faction: '一般學生',
    title: '家畜名冊', grade: '一年級', blood: 'O', birthday: '2 月 2 日',
    tags: ['家畜', '膽小', '月錢'],
    quote: '「我這個月的月錢……可以再寬限一天嗎？」',
    bio: '每個月都在繳納金與生活費之間掙扎的學生。她不是不會賭，只是每次贏了一點就急著收手，於是永遠停在名冊的邊緣。'
  },
  {
    id: 'ouri', name: '下月売奥理', init: '下', cls: 'ouri', faction: '一般學生',
    title: '家畜名冊', grade: '三年級', blood: 'AB', birthday: '9 月 9 日',
    tags: ['家畜', '商人', '情報販子'],
    quote: '「情報比錢好用。錢會花完，情報可以賣很多次。」',
    bio: '校內的情報販子，欠款卻始終還不完。他總說自己只是暫時坐在家畜區，等手上的消息賣到好價錢就會翻身。'
  },
  {
    id: 'ibara', name: '尾喰茨', init: '茨', cls: 'ibara', faction: '一般學生',
    title: '家畜名冊', grade: '三年級', blood: 'B', birthday: '3 月 3 日',
    tags: ['家畜', '強硬', '談判'],
    quote: '「要我低頭可以。先把利息算清楚。」',
    bio: '態度強硬的學生，即使在家畜名冊上也不肯示弱。他會和學生會爭每一筆利息，雖然從來沒有贏過，卻讓催收的人記住了他的名字。'
  },
  {
    id: 'rin', name: '尾喰凛', init: '凛', cls: 'rin', faction: '一般學生',
    title: '家畜名冊', grade: '一年級', blood: 'A', birthday: '12 月 1 日',
    tags: ['家畜', '新人', '緊張'],
    quote: '「我只是想贏一次。一次就好。」',
    bio: '剛被寫進名冊的學生，還不太會掩飾自己的緊張。她把每一次下注都當成最後一次，於是每一次都押得太重。'
  },
  {
    id: 'ririka', name: '桃喰リリカ', init: '莉', cls: 'ririka', faction: '一般學生',
    title: '一般學生 · 桃喰家', grade: '一年級', blood: 'AB', birthday: '11 月 3 日',
    tags: ['桃喰家', '觀察者', '謎'],
    quote: '「姐姐的遊戲，我也想看結局。」',
    bio: '桃喰綺羅莉的妹妹，總在人群外圍安靜地看著。她不常下場，卻似乎比任何人都清楚這場遊戲最後會由誰寫下規則。'
  },
  {
    id: 'tsuzura', name: '花手毬つづら', init: '花', cls: 'tsuzura', faction: '一般學生',
    title: '一般學生 · 偶像研究會', grade: '二年級', blood: 'O', birthday: '5 月 20 日',
    tags: ['偶像研究會', '情報', '人脈'],
    quote: '「偶像研究會什麼都聽得到。要買消息嗎？算你便宜一點。」',
    bio: '偶像研究會的成員，靠人脈與小道消息在校內生存。她知道誰剛輸光、誰還藏著錢，也知道哪一張牌桌今晚會出事。'
  }
];

export const CAST_BY_ID = Object.fromEntries(CAST.map(c => [c.id, c]));

export function castById(id) {
  return CAST_BY_ID[id] || null;
}

export function castByFaction(faction) {
  return CAST.filter(c => c.faction === faction);
}

/* ---------- 校內學生（固定順序程序生成，存檔以 id 對應） ---------- */
const SURNAMES = [
  '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡邊', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '佐佐木', '山口', '松本', '井上', '木村', '林', '清水', '山崎',
  '森', '池田', '橋本', '阿部', '石川', '前田', '藤田', '小川', '岡田', '後藤',
  '長谷川', '村上', '近藤', '石井', '齊藤', '坂本', '遠藤', '青木', '藤井', '西村'
];
const GIVENS = [
  '陽菜', '結衣', '美咲', '葵', '凜', '澪', '楓', '柚希', '心春', '千尋',
  '遙', '咲良', '美月', '愛莉', '芽依', '詩織', '彩花', '真央', '優奈', '日菜',
  '未來', '琴音', '莉子', '杏奈', '七海', '花音', '麻衣', '千夏', '春菜', '沙耶',
  '美羽', '玲奈', '早紀', '直子', '由紀', '恵美', '香織', '綾乃', '千鶴', '瑞希',
  '蓮', '翔太', '悠真', '大和', '颯太', '健太', '拓海', '亮介', '恭平', '直樹',
  '慎也', '和也', '雄大', '龍之介', '圭吾', '修平', '達也', '雅人', '智也', '光'
];
const CLUBS = [
  '麻將研究會', '撲克研究會', '骰子研究會', '賭博部', '文學部', '游泳部',
  '學生議會', '新聞部', '茶道部', '劍道部', '美術部', '輕音部', '園藝部', '天文部',
  '料理研究會', '電腦研究會', '攝影部', '戲劇部', '排球部', '田徑隊',
  '將棋研究會', '圍棋研究會', '花道部', '書法部', '辯論部', '電影研究會',
  '化學研究會', '生物研究會', '歷史研究會', '家政部'
];
const STYLES = [
  { key: 'cold', label: '冷靜算牌', quote: '「我算過勝率。你確定還要坐下來？」', bio: '以期望值與牌路為信仰，坐上牌桌前會先默算每一種可能。' },
  { key: 'hot', label: '孤注一擲', quote: '「小注沒意思。要賭，就把整疊推出去。」', bio: '把每一局都當成最後一局，押注從來不給自己留退路。' },
  { key: 'grinder', label: '慢慢磨', quote: '「一次贏一點就好。桌子會記得誰留到最後。」', bio: '不追求一擊致富，靠一次次小贏累積出一點底氣。' },
  { key: 'bluffer', label: '虛張聲勢', quote: '「我臉上看不出來的，牌面上也看不出來。」', bio: '擅長把爛牌說成好牌，讓對手在最後一刻自己蓋掉勝利。' },
  { key: 'lucky', label: '迷信運氣', quote: '「今天的月色不錯，運氣站在我這邊。」', bio: '相信運氣與時辰，總在奇怪的時刻做出正確的決定。' },
  { key: 'observe', label: '觀察對手', quote: '「你剛剛摸了三次耳垂。那副牌，應該不怎麼樣。」', bio: '習慣先看人再看牌，對手的呼吸與手指比牌面更誠實。' },
  { key: 'greedy', label: '貪賠率', quote: '「賠率越高越好。風險？那是輸的人才會算的東西。」', bio: '看到高賠率就挪不開眼睛，為此輸掉的錢也不比贏的少。' },
  { key: 'timid', label: '怕輸收手', quote: '「贏一點就夠了……真的，這次收手就好。」', bio: '每次贏了一點就想收手，於是永遠差一步才翻身。' }
];
const CLS_PALETTE = ['rin', 'ibara', 'mira', 'ouri', 'kaede', 'yuriko', 'nozomi', 'mitsuyo', 'miri', 'erine'];
const GRADES = ['一年級', '二年級', '三年級'];
const BLOODS = ['A', 'B', 'O', 'AB'];
const GAMES = ['blackjack', 'mahjong', 'holdem'];
const GAME_NAMES = { blackjack: '21點', mahjong: '麻將', holdem: '德州撲克' };

function mulberry(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const GENERATED = Array.from({ length: 108 }, (_, i) => {
  const rnd = mulberry(i * 9301 + 49297);
  const surname = SURNAMES[i % SURNAMES.length];
  const given = GIVENS[(i * 13 + Math.floor(i / SURNAMES.length) * 7) % GIVENS.length];
  const style = STYLES[Math.floor(rnd() * STYLES.length)];
  const club = CLUBS[Math.floor(rnd() * CLUBS.length)];
  const grade = GRADES[Math.floor(rnd() * GRADES.length)];
  const blood = BLOODS[Math.floor(rnd() * BLOODS.length)];
  const game = GAMES[Math.floor(rnd() * GAMES.length)];
  const month = 1 + Math.floor(rnd() * 12);
  const day = 1 + Math.floor(rnd() * 28);
  return {
    id: 's' + String(i + 1).padStart(3, '0'),
    name: surname + given,
    init: given[0],
    cls: CLS_PALETTE[i % CLS_PALETTE.length],
    faction: '一般學生',
    title: '一般學生 · ' + club,
    grade,
    blood,
    birthday: `${month} 月 ${day} 日`,
    tags: [club, style.label, GAME_NAMES[game] + '常客'],
    quote: style.quote,
    bio: `${club}的成員。${style.bio}`,
    style: style.key,
    game,
    baseAffinity: 5 + Math.floor(rnd() * 16),
    wagerUnit: 10000 + Math.floor(rnd() * 5) * 10000
  };
});

export const STUDENTS = [...CAST, ...GENERATED];
export const STUDENTS_BY_ID = Object.fromEntries(STUDENTS.map(c => [c.id, c]));

export function studentById(id) {
  return STUDENTS_BY_ID[id] || null;
}

export function studentsByFaction(faction) {
  return STUDENTS.filter(c => c.faction === faction);
}
