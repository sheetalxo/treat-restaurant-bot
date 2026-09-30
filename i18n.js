// ======================================================
// LANGUAGES:  en = English, hi = Hindi (Devanagari), hg = Hinglish
// If a language is missing for a key, English is used.
// Button titles: max 20 chars. List row titles: max 24 chars.
// ======================================================
 
const S = {
  // ---------- language + welcome ----------
  langPrompt: {
    en: "Please select your language\nअपनी भाषा चुनें\nApni language chuno"
  },
 
  // step 1: order type first
  welcome: {
    en: "Welcome to TREAT RESTAURANT 🍽️\n\nHow would you like to receive your order?",
    hi: "TREAT RESTAURANT में आपका स्वागत है 🍽️\n\nआप अपना ऑर्डर कैसे लेना चाहेंगे?",
    hg: "TREAT RESTAURANT mein aapka swagat hai 🍽️\n\nOrder kaise lena chahoge?"
  },
  // step 2: after order type is chosen
  menuStart: {
    en: "What would you like to order? 🍽️",
    hi: "आप क्या ऑर्डर करना चाहेंगे? 🍽️",
    hg: "Aap kya order karna chahoge? 🍽️"
  },
  chooseTypeFirst: {
    en: "Please choose first how you want to receive your order 👇",
    hi: "पहले चुनें कि आप ऑर्डर कैसे लेना चाहेंगे 👇",
    hg: "Pehle choose karo ki order kaise lena hai 👇"
  },
  closed: {
    en: "😴 Sorry, TREAT RESTAURANT is closed right now.\n\n🕥 Timings: 10:30 AM – 10:30 PM (every day)\n\nPlease message us again during opening hours. 🙏",
    hi: "😴 क्षमा करें, TREAT RESTAURANT अभी बंद है।\n\n🕥 समय: सुबह 10:30 से रात 10:30 तक (रोज़)\n\nकृपया खुलने के समय में दोबारा मैसेज करें। 🙏",
    hg: "😴 Sorry, TREAT RESTAURANT abhi band hai.\n\n🕥 Timing: subah 10:30 se raat 10:30 tak (roz)\n\nPlease khulne ke time pe dobara message karo. 🙏"
  },
  welcome2: {
    en: "Or choose an option below 👇",
    hi: "या नीचे से कोई विकल्प चुनें 👇",
    hg: "Ya neeche se koi option chuno 👇"
  },
  btnMenuPdf: { en: "📄 MENU PDF", hi: "📄 मेनू PDF" },
  btnWrite: { en: "✍️ WRITE ORDER", hi: "✍️ लिखकर ऑर्डर", hg: "✍️ LIKH KE ORDER" },
  btnLang: { en: "🌐 LANGUAGE", hi: "🌐 भाषा" },
 
  writePrompt: {
    en:
      "✍️ Type your order and send it.\n\n" +
      "Example:\n2 veg steam momos, 1 dal makhani, 3 butter naan\n\n" +
      "• If you type only a category (like \"pizza\"), I'll show you the options.\n" +
      "• You can add \"half\" / \"full\" / \"boneless\" / \"extra cheese\".\n" +
      "• Type \"cart\" anytime to see your cart.\n\n" +
      "(Please write item names in English letters.)",
    hi:
      "✍️ अपना ऑर्डर लिखकर भेजें।\n\n" +
      "उदाहरण:\n2 veg steam momos, 1 dal makhani, 3 butter naan\n\n" +
      "• अगर आप सिर्फ़ कैटेगरी लिखेंगे (जैसे \"pizza\"), तो मैं उसके ऑप्शन दिखाऊँगा।\n" +
      "• आप \"half\" / \"full\" / \"boneless\" / \"extra cheese\" भी लिख सकते हैं।\n" +
      "• अपना कार्ट देखने के लिए कभी भी \"cart\" लिखें।\n\n" +
      "(आइटम के नाम English अक्षरों में लिखें।)",
    hg:
      "✍️ Apna order likh ke bhejo.\n\n" +
      "Example:\n2 veg steam momos, 1 dal makhani, 3 butter naan\n\n" +
      "• Sirf category likhoge (jaise \"pizza\") to main uske options dikha dunga.\n" +
      "• \"half\" / \"full\" / \"boneless\" / \"extra cheese\" bhi likh sakte ho.\n" +
      "• Cart dekhne ke liye kabhi bhi \"cart\" likho.\n\n" +
      "(Item ke naam English letters mein likhna.)"
  },
 
  menuPdfCaption: { en: "TREAT RESTAURANT — Menu 📄" },
  menuPdfError: {
    en: "Sorry, the menu PDF is not available right now. Please use the buttons to browse the menu.",
    hi: "क्षमा करें, मेनू PDF अभी उपलब्ध नहीं है। कृपया बटन से मेनू देखें।",
    hg: "Sorry, menu PDF abhi available nahi hai. Buttons se menu dekh lo."
  },
  notUnderstood: {
    en: "Sorry, I couldn't understand that. Please use the buttons below, or tap ✍️ WRITE ORDER to see how to type an order.",
    hi: "क्षमा करें, मैं समझ नहीं पाया। कृपया नीचे दिए बटन इस्तेमाल करें, या ✍️ लिखकर ऑर्डर दबाकर तरीका देखें।",
    hg: "Sorry, samajh nahi aaya. Neeche ke buttons use karo, ya ✍️ LIKH KE ORDER dabao aur tarika dekho."
  },
 
  // ---------- category / item lists ----------
  catBody: {
    en: (label, both) => `🍽️ ${label} MENU\n\nChoose a category:` + (both ? "\n🟢 veg  🔴 non-veg" : ""),
    hi: (label, both) => `🍽️ ${label} मेनू\n\nकैटेगरी चुनें:` + (both ? "\n🟢 शाकाहारी  🔴 मांसाहारी" : ""),
    hg: (label, both) => `🍽️ ${label} MENU\n\nCategory chuno:` + (both ? "\n🟢 veg  🔴 non-veg" : "")
  },
  itemBody: {
    en: (cat, both) => `🍽️ ${cat}\n\nSelect an item:` + (both ? "\n🟢 veg  🔴 non-veg" : ""),
    hi: (cat, both) => `🍽️ ${cat}\n\nआइटम चुनें:` + (both ? "\n🟢 शाकाहारी  🔴 मांसाहारी" : ""),
    hg: (cat, both) => `🍽️ ${cat}\n\nItem chuno:` + (both ? "\n🟢 veg  🔴 non-veg" : "")
  },
  btnViewCats: { en: "VIEW CATEGORIES", hi: "कैटेगरी देखें", hg: "CATEGORY DEKHO" },
  btnViewFood: { en: "VIEW FOOD", hi: "आइटम देखें", hg: "ITEM DEKHO" },
  btnChoose: { en: "CHOOSE ITEM", hi: "आइटम चुनें", hg: "ITEM CHUNO" },
  btnChooseCat: { en: "CHOOSE CATEGORY", hi: "कैटेगरी चुनें", hg: "CATEGORY CHUNO" },
  sectionCats: {
    en: (l) => `${l} CATEGORIES`,
    hi: (l) => `${l} कैटेगरी`,
    hg: (l) => `${l} CATEGORIES`
  },
  pageOf: {
    en: (p, n) => `Page ${p}/${n}`,
    hi: (p, n) => `पेज ${p}/${n}`,
    hg: (p, n) => `Page ${p}/${n}`
  },
  navPrev: { en: "⬅ PREVIOUS", hi: "⬅ पिछला", hg: "⬅ PICHLA" },
  navPrevDesc: {
    en: (p, n) => `Go back (page ${p} of ${n})`,
    hi: (p, n) => `पीछे जाएँ (पेज ${p}/${n})`,
    hg: (p, n) => `Peeche jao (page ${p}/${n})`
  },
  navMore: { en: "➡ MORE", hi: "➡ और देखें", hg: "➡ AUR DEKHO" },
  navMoreDesc: {
    en: (p, n) => `See more (page ${p} of ${n})`,
    hi: (p, n) => `और देखें (पेज ${p}/${n})`,
    hg: (p, n) => `Aur dekho (page ${p}/${n})`
  },
  navBackMain: { en: "🔙 VEG/NON-VEG" },
  navBackMainDesc: {
    en: "Change VEG / NON-VEG / BOTH",
    hi: "VEG / NON-VEG / BOTH बदलें",
    hg: "VEG / NON-VEG / BOTH badlo"
  },
  navBackCats: { en: "🔙 CATEGORIES", hi: "🔙 कैटेगरी", hg: "🔙 CATEGORY" },
  navBackCatsDesc: {
    en: "Back to categories",
    hi: "कैटेगरी पर वापस जाएँ",
    hg: "Categories pe wapas jao"
  },
  navClear: { en: "🗑 CLEAR CART", hi: "🗑 कार्ट खाली करें", hg: "🗑 CART KHALI KARO" },
  navClearDesc: { en: "Remove everything", hi: "सब कुछ हटाएँ", hg: "Sab kuch hata do" },
  catDesc: {
    en: (c) => `View ${c}`,
    hi: (c) => `${c} देखें`,
    hg: (c) => `${c} dekho`
  },
 
  // ---------- item options ----------
  variantBody: {
    en: (n) => `🍽️ ${n}\n\nChoose plate size:`,
    hi: (n) => `🍽️ ${n}\n\nप्लेट साइज़ चुनें:`,
    hg: (n) => `🍽️ ${n}\n\nPlate size chuno:`
  },
  btnHalf: { en: (p) => `HALF ₹${p}`, hi: (p) => `हाफ ₹${p}` },
  btnFull: { en: (p) => `FULL ₹${p}`, hi: (p) => `फुल ₹${p}` },
 
  boneBody: {
    en: (n, c) => `🍗 ${n}\n\nBone-in or Boneless?\nBoneless = +₹${c} per plate`,
    hi: (n, c) => `🍗 ${n}\n\nहड्डी सहित या बोनलेस?\nबोनलेस = +₹${c} प्रति प्लेट`,
    hg: (n, c) => `🍗 ${n}\n\nBone-in ya Boneless?\nBoneless = +₹${c} per plate`
  },
  btnWithBone: { en: "WITH BONE", hi: "हड्डी सहित" },
  btnBoneless: { en: (c) => `BONELESS +₹${c}`, hi: (c) => `बोनलेस +₹${c}` },
 
  cheeseBody: {
    en: (n, c) => `🍕 ${n}\n\nWant extra cheese?\nExtra cheese = +₹${c} per pizza`,
    hi: (n, c) => `🍕 ${n}\n\nएक्स्ट्रा चीज़ चाहिए?\nएक्स्ट्रा चीज़ = +₹${c} प्रति पिज़्ज़ा`,
    hg: (n, c) => `🍕 ${n}\n\nExtra cheese chahiye?\nExtra cheese = +₹${c} per pizza`
  },
  btnNoCheese: { en: "NO CHEESE", hi: "चीज़ नहीं" },
  btnCheese: { en: (c) => `EXTRA CHEESE +₹${c}`, hi: (c) => `चीज़ +₹${c}` },
 
  // ---------- quantity ----------
  qtyBody: {
    en: (n, o, p, q, t) =>
      `🍽️ ${n}${o}\n\nPrice: ₹${p}\nQuantity: ${q}\nItem Total: ₹${t}\n\nNeed more? Tap ✍️ TYPE QTY and type a number.`,
    hi: (n, o, p, q, t) =>
      `🍽️ ${n}${o}\n\nकीमत: ₹${p}\nमात्रा: ${q}\nआइटम टोटल: ₹${t}\n\nज़्यादा चाहिए? ✍️ संख्या लिखें दबाएँ और नंबर लिखें।`,
    hg: (n, o, p, q, t) =>
      `🍽️ ${n}${o}\n\nPrice: ₹${p}\nQuantity: ${q}\nItem Total: ₹${t}\n\nZyada chahiye? ✍️ QTY LIKHO dabao aur number likho.`
  },
  btnTypeQty: { en: "✍️ TYPE QTY", hi: "✍️ संख्या लिखें", hg: "✍️ QTY LIKHO" },
  qtyFinal: {
    en: "Is the quantity final?",
    hi: "क्या मात्रा फ़ाइनल है?",
    hg: "Quantity final hai?"
  },
  btnAddCart: { en: "✅ ADD TO CART", hi: "✅ कार्ट में जोड़ें" },
  btnBack: { en: "🔙 BACK", hi: "🔙 वापस" },
  typeQtyPrompt: {
    en: (m) => `✍️ How many do you want? Type a number (e.g. 4, 10, 25).\n\nMax ${m}.`,
    hi: (m) => `✍️ आपको कितने चाहिए? नंबर लिखकर भेजें (जैसे 4, 10, 25)।\n\nअधिकतम ${m}।`,
    hg: (m) => `✍️ Kitne chahiye? Number likh ke bhejo (jaise 4, 10, 25).\n\nMax ${m}.`
  },
  qtyInvalid: {
    en: "Quantity must be 1 or more. Type a number (e.g. 5).",
    hi: "मात्रा कम से कम 1 होनी चाहिए। नंबर लिखें (जैसे 5)।",
    hg: "Quantity kam se kam 1 honi chahiye. Number likho (jaise 5)."
  },
  qtyMax: {
    en: (m) => `Maximum ${m} allowed. For bulk orders please call the restaurant directly.`,
    hi: (m) => `अधिकतम ${m} की अनुमति है। बड़े ऑर्डर के लिए कृपया रेस्टोरेंट को सीधे कॉल करें।`,
    hg: (m) => `Max ${m} allowed hai. Bulk order ke liye restaurant ko seedha call karo.`
  },
  qtyOnlyNumber: {
    en: "Please type only a number, e.g. 3 or 10.",
    hi: "कृपया सिर्फ़ नंबर लिखें, जैसे 3 या 10।",
    hg: "Sirf number likho, jaise 3 ya 10."
  },
 
  // ---------- cart ----------
  cartTitle: { en: "🛒 YOUR CART", hi: "🛒 आपका कार्ट", hg: "🛒 AAPKA CART" },
  subtotalLbl: { en: "Subtotal", hi: "सबटोटल" },
  cartEmpty: {
    en: "🛒 Your cart is empty.\n\nWould you like to view the menu?",
    hi: "🛒 आपका कार्ट खाली है।\n\nक्या आप मेनू देखना चाहेंगे?",
    hg: "🛒 Aapka cart khali hai.\n\nMenu dekhna chahoge?"
  },
  btnViewMenu: { en: "VIEW MENU", hi: "मेनू देखें", hg: "MENU DEKHO" },
  btnBackShort: { en: "BACK", hi: "वापस" },
  btnAddMore: { en: "ADD MORE", hi: "और जोड़ें", hg: "AUR ADD KARO" },
  btnRemove: { en: "REMOVE", hi: "हटाएँ", hg: "HATAO" },
  btnCheckout: { en: "CHECKOUT", hi: "चेकआउट" },
  btnViewCart: { en: "VIEW CART", hi: "कार्ट देखें", hg: "CART DEKHO" },
  whatNext: {
    en: (s) => `Subtotal: ₹${s}\n\nWhat next?`,
    hi: (s) => `सबटोटल: ₹${s}\n\nअब आगे क्या करें?`,
    hg: (s) => `Subtotal: ₹${s}\n\nAb aage kya karein?`
  },
  removeBody: {
    en: "🗑️ REMOVE ITEM\n\nSelect the item you want to remove:",
    hi: "🗑️ आइटम हटाएँ\n\nजो आइटम हटाना है उसे चुनें:",
    hg: "🗑️ ITEM HATAO\n\nJo item hatana hai use chuno:"
  },
  btnRemoveItem: { en: "REMOVE ITEM", hi: "आइटम हटाएँ", hg: "ITEM HATAO" },
  removeSection: { en: "YOUR CART", hi: "आपका कार्ट", hg: "AAPKA CART" },
 
  // ---------- checkout ----------
  minOrder: {
    en: (m, s) => `⚠️ Minimum food order is ₹${m}.\nYour subtotal is ₹${s}. Please add ₹${m - s} more.`,
    hi: (m, s) => `⚠️ न्यूनतम फ़ूड ऑर्डर ₹${m} है।\nआपका सबटोटल ₹${s} है। कृपया ₹${m - s} और जोड़ें।`,
    hg: (m, s) => `⚠️ Minimum food order ₹${m} hai.\nAapka subtotal ₹${s} hai. ₹${m - s} ka aur add karo.`
  },
  orderTypeBody: {
    en: "How would you like to receive your order?",
    hi: "आप अपना ऑर्डर कैसे लेना चाहेंगे?",
    hg: "Order kaise lena chahoge?"
  },
  btnDineIn: { en: "🪑 DINE-IN", hi: "🪑 डाइन-इन" },
  btnTakeaway: { en: "🥡 TAKEAWAY", hi: "🥡 टेकअवे" },
  btnDelivery: { en: "🛵 DELIVERY", hi: "🛵 डिलीवरी" },
  askVisit: {
    en: "🪑 When do you plan to visit the restaurant?\n\nExample: 7:30 PM",
    hi: "🪑 आप रेस्टोरेंट कब आने की योजना बना रहे हैं?\n\nउदाहरण: 7:30 PM",
    hg: "🪑 Aap restaurant kab aane ka plan kar rahe ho?\n\nExample: 7:30 PM"
  },
  askAddress: {
    en: "🏠 Please type your *full delivery address* (house no., area, landmark).",
    hi: "🏠 कृपया अपना *पूरा डिलीवरी पता* लिखें (मकान नं., एरिया, लैंडमार्क)।",
    hg: "🏠 Apna *poora delivery address* likh ke bhejo (house no., area, landmark)."
  },
  addressShort: {
    en: "Please write the address in more detail (house no., area, landmark).",
    hi: "कृपया पता थोड़ा विस्तार से लिखें (मकान नं., एरिया, लैंडमार्क)।",
    hg: "Address thoda detail mein likho (house no., area, landmark)."
  },
  askLocation: {
    en: "📍 Please send your *location pin* so the delivery charge can be calculated.\n\nTap 📎 → Location → Send your current location.",
    hi: "📍 कृपया अपनी *लोकेशन पिन* भेजें ताकि डिलीवरी चार्ज निकाला जा सके।\n\n📎 दबाएँ → Location → Send your current location।",
    hg: "📍 Please apni *location pin* bhejo taaki delivery charge calculate ho sake.\n\n📎 dabao → Location → Send your current location."
  },
  askLocationBtn: {
    en: () => `🛵 For delivery, please share your *delivery location* using the button below.\n\nDelivery charges will be calculated automatically and shown on your bill.`,
    hi: () => `🛵 डिलीवरी के लिए नीचे के बटन से अपनी *डिलीवरी लोकेशन* भेजें।\n\nडिलीवरी चार्ज अपने आप calculate होकर आपके बिल में दिखेगा।`,
    hg: () => `🛵 Delivery ke liye neeche ke button se apni *delivery location* bhejo.\n\nDelivery charge automatically calculate hoke aapke bill mein dikhega.`
  },
  deliveryInfo: {
    en: () => `📍 Location received!\nDelivery charges will be added to your bill.`,
    hi: () => `📍 लोकेशन मिल गई!\nडिलीवरी चार्ज आपके बिल में जुड़ जाएगा।`,
    hg: () => `📍 Location mil gayi!\nDelivery charge aapke bill mein add ho jayega.`
  },
  addressSaved: {
    en: "✅ Address saved.",
    hi: "✅ पता सेव हो गया।",
    hg: "✅ Address save ho gaya."
  },
  visitSaved: {
    en: (t) => `✅ Expected visit time: ${t}`,
    hi: (t) => `✅ आने का समय: ${t}`,
    hg: (t) => `✅ Aane ka time: ${t}`
  },
  needLocation: {
    en: "Please send a location pin (📎 → Location). Delivery charge can't be calculated without it.",
    hi: "कृपया लोकेशन पिन भेजें (📎 → Location)। इसके बिना डिलीवरी चार्ज नहीं निकल सकता।",
    hg: "Please location pin bhejo (📎 → Location). Uske bina delivery charge nahi ban sakta."
  },
  deliveryNotConfigured: {
    en: "Delivery is not available right now. Please choose takeaway or dine-in.",
    hi: "डिलीवरी अभी उपलब्ध नहीं है। कृपया टेकअवे या डाइन-इन चुनें।",
    hg: "Delivery abhi available nahi hai. Takeaway ya dine-in choose karo."
  },
  tooFar: {
    en: "😔 Sorry, your location is outside our delivery area. You can choose takeaway or dine-in.",
    hi: "😔 क्षमा करें, आपकी लोकेशन हमारे डिलीवरी क्षेत्र से बाहर है। आप टेकअवे या डाइन-इन चुन सकते हैं।",
    hg: "😔 Sorry, aapki location hamare delivery area se bahar hai. Takeaway ya dine-in choose kar sakte ho."
  },
 
  // ---------- bill ----------
  billSubtotal: { en: "Food Subtotal", hi: "फूड सबटोटल" },
  billPacking: { en: "Packing Charges", hi: "पैकिंग चार्ज" },
  billDelivery: { en: "Delivery Charges", hi: "डिलीवरी चार्ज" },
  billDiscount: { en: "Discount", hi: "छूट" },
  billTotal: { en: "TOTAL", hi: "कुल" },
  billType: { en: "Order type", hi: "ऑर्डर टाइप" },
  billVisit: { en: "Expected Visit", hi: "आने का समय" },
  billAddress: { en: "Address", hi: "पता" },
  payBody: {
    en: "Choose payment method:",
    hi: "पेमेंट का तरीका चुनें:",
    hg: "Payment method chuno:"
  },
  btnPayOnline: { en: "💳 PAY ONLINE", hi: "💳 ऑनलाइन पेमेंट", hg: "💳 ONLINE PAY" },
  btnCod: { en: "💵 CASH ON DELIVERY", hi: "💵 कैश ऑन डिलीवरी", hg: "💵 COD" },
  btnCounter: { en: "💵 PAY AT COUNTER", hi: "💵 काउंटर पर पेमेंट", hg: "💵 COUNTER PE PAY" },
  btnEdit: { en: "✏️ EDIT CART", hi: "✏️ कार्ट बदलें", hg: "✏️ CART EDIT" },
 
  cashConfirmed: {
    en: (id, t, del) =>
      `✅ Order confirmed!\n\nOrder ID: *${id}*\nTotal: ₹${t}\nPayment: ${del ? "Cash on delivery" : "Pay at counter"}\n\nThank you for ordering from TREAT RESTAURANT 🙏`,
    hi: (id, t, del) =>
      `✅ ऑर्डर कन्फ़र्म हो गया!\n\nऑर्डर ID: *${id}*\nकुल: ₹${t}\nपेमेंट: ${del ? "कैश ऑन डिलीवरी" : "काउंटर पर पेमेंट"}\n\nTREAT RESTAURANT से ऑर्डर करने के लिए धन्यवाद 🙏`,
    hg: (id, t, del) =>
      `✅ Order confirm ho gaya!\n\nOrder ID: *${id}*\nTotal: ₹${t}\nPayment: ${del ? "Cash on delivery" : "Counter pe payment"}\n\nTREAT RESTAURANT se order karne ke liye thank you 🙏`
  },
  payLink: {
    en: (id, t, link) =>
      `💳 Order ID: *${id}*\nAmount: *₹${t}*\n\nOpen this link to pay:\n${link}\n\nYou'll get a confirmation here once the payment is done. The link expires in 30 minutes.`,
    hi: (id, t, link) =>
      `💳 ऑर्डर ID: *${id}*\nराशि: *₹${t}*\n\nपेमेंट के लिए यह लिंक खोलें:\n${link}\n\nपेमेंट होते ही यहीं कन्फ़र्मेशन मिल जाएगा। लिंक 30 मिनट में एक्सपायर हो जाएगा।`,
    hg: (id, t, link) =>
      `💳 Order ID: *${id}*\nAmount: *₹${t}*\n\nPay karne ke liye link kholo:\n${link}\n\nPayment hote hi yahin confirmation mil jayega. Link 30 minute mein expire hoga.`
  },
  payReceived: {
    en: (id, t) => `✅ Payment received!\n\nOrder ID: *${id}*\nAmount: ₹${t}\n\nYour order is confirmed. Thank you 🙏`,
    hi: (id, t) => `✅ पेमेंट मिल गया!\n\nऑर्डर ID: *${id}*\nराशि: ₹${t}\n\nआपका ऑर्डर कन्फ़र्म हो गया है। धन्यवाद 🙏`,
    hg: (id, t) => `✅ Payment mil gaya!\n\nOrder ID: *${id}*\nAmount: ₹${t}\n\nAapka order confirm ho gaya hai. Thank you 🙏`
  },
  payUnavailable: {
    en: "😔 Online payment is not available right now. Would you like to pay by cash?",
    hi: "😔 ऑनलाइन पेमेंट अभी उपलब्ध नहीं है। क्या आप कैश से पेमेंट करना चाहेंगे?",
    hg: "😔 Online payment abhi available nahi hai. Cash se payment karna chahoge?"
  },
  payPending: {
    en: "⏳ You already have an unpaid online order. Please complete that payment first (the link stays valid for 30 minutes), or place a new order after it expires.",
    hi: "⏳ आपका एक ऑनलाइन ऑर्डर का पेमेंट अभी बाकी है। पहले वही पेमेंट पूरा करें (लिंक 30 मिनट तक चालू रहता है) या लिंक एक्सपायर होने के बाद नया ऑर्डर करें।",
    hg: "⏳ Aapka ek online order ka payment abhi pending hai. Pehle wahi payment kar lo (link 30 minute chalta hai) ya link expire hone ke baad naya order karo."
  },
  btnPayCash: { en: "💵 PAY CASH", hi: "💵 कैश पेमेंट", hg: "💵 CASH PAY" },
  invoiceCaption: {
    en: (id) => `🧾 Invoice for order ${id}`,
    hi: (id) => `🧾 ऑर्डर ${id} का इनवॉइस`,
    hg: (id) => `🧾 Order ${id} ka invoice`
  },
 
  // ---------- typed orders ----------
  typedAdded: {
    en: (lines) => `✅ Added to your cart:\n${lines.join("\n")}`,
    hi: (lines) => `✅ आपके कार्ट में जोड़ा गया:\n${lines.join("\n")}`,
    hg: (lines) => `✅ Cart mein add ho gaya:\n${lines.join("\n")}`
  },
  typedUnknown: {
    en: (list) => `❓ I couldn't understand:\n${list.map((x) => "• " + x).join("\n")}\n\nPlease check the spelling (write in English letters) or use the menu.`,
    hi: (list) => `❓ ये मुझे समझ नहीं आया:\n${list.map((x) => "• " + x).join("\n")}\n\nकृपया स्पेलिंग जाँचें (English अक्षरों में लिखें) या मेनू इस्तेमाल करें।`,
    hg: (list) => `❓ Ye samajh nahi aaya:\n${list.map((x) => "• " + x).join("\n")}\n\nSpelling check karo (English letters mein likho) ya menu use karo.`
  },
  pickBody: {
    en: (q) => `Which one did you mean for "${q}"?`,
    hi: (q) => `"${q}" में से आपको कौन सा चाहिए?`,
    hg: (q) => `"${q}" mein se kaunsa chahiye?`
  },
  catFromText: {
    en: (c) => `You wrote a category (${c}). Please choose the item you want:`,
    hi: (c) => `आपने कैटेगरी (${c}) लिखी है। कृपया अपना आइटम चुनें:`,
    hg: (c) => `Aapne category (${c}) likhi hai. Apna item chuno:`
  },
  catPickBody: {
    en: (q) => `"${q}" is in more than one category. Choose one:`,
    hi: (q) => `"${q}" एक से ज़्यादा कैटेगरी में है। एक चुनें:`,
    hg: (q) => `"${q}" ek se zyada category mein hai. Ek chuno:`
  }
};
 
function t(lang, key, ...args) {
  const entry = S[key];
  if (!entry) return key;
  const v = entry[lang] !== undefined ? entry[lang] : entry.en;
  return typeof v === "function" ? v(...args) : v;
}
 
module.exports = { t };
