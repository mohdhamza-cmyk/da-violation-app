import { useState, useEffect, useRef } from "react";

interface StoreInfo {
  tl: string;
  supervisor: string;
  am: string;
  cityManager: string;
  country?: string; // defaults to DEFAULT_COUNTRY when absent (legacy/hardcoded)
}
interface FileItem {
  id: string;
  name: string;
  type: "image" | "video";
  preview: string;
  file: File;
}
interface Submission {
  id: string;
  timestamp: string;
  date: string;
  hourSlot: string;
  country: string;
  store: string;
  tl: string;
  supervisor: string;
  am: string;
  cityManager: string;
  sections: {
    inside: Omit<FileItem, "id" | "file">[];
    outside: Omit<FileItem, "id" | "file">[];
    parking: Omit<FileItem, "id" | "file">[];
  };
  totalFiles: number;
}
interface SheetRow {
  ID: string;
  Timestamp: string;
  Date: string;
  HourSlot: string;
  Store: string;
  TL: string;
  Supervisor: string;
  AM: string;
  CityManager: string;
  Inside_Count: string;
  Outside_Count: string;
  Parking_Count: string;
  TotalFiles: string;
  DriveLink?: string;
  FileLinks?: string;
  Week?: string;
  Country?: string;
}

// Hardcoded mapping below is the FALLBACK. On load the app fetches the live
// mapping from the store-list sheet (via Apps Script ?stores) and overwrites
// these — so adding/removing a store or changing a TL/Supervisor/AM/Manager in
// that sheet updates the app automatically, with this as a safety net.
let STORE_MAPPING: Record<string, StoreInfo> = {
  // ── HAMZA KHAN — Nitesh Nair / Kiran Anand ──────────────────────────────
  "Dubai Festival City": {
    tl: "Soleman",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Garhoud": {
    tl: "Soleman",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Nadd Al Hamar": {
    tl: "Soleman",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Muhaisnah 2": {
    tl: "Soleman",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Qusais 5": {
    tl: "Soleman",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Qusais 4": {
    tl: "Soleman",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Qusais": {
    tl: "Sivaprakash",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Qusais 2": {
    tl: "Sivaprakash",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Nahda - Dubai": {
    tl: "Sivaprakash",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Qusais 3": {
    tl: "Sivaprakash",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Nahda 2 - Dubai": {
    tl: "Sivaprakash",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Nahda 3 - Dubai": {
    tl: "Sivaprakash",
    supervisor: "Nitesh Nair",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Rashidiya": {
    tl: "Salman Haider",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  Muhaisnah: {
    tl: "Salman Haider",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Mirdif 2": {
    tl: "Salman Haider",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Warqa 2": {
    tl: "Salman Haider",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "International City 2": {
    tl: "Salman Haider",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Khawaneej": {
    tl: "Abhishek Shafi",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "International City": {
    tl: "Abhishek Shafi",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Warqaa": {
    tl: "Abhishek Shafi",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Al Mizhar 1": {
    tl: "Abhishek Shafi",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  Mirdif: {
    tl: "Abhishek Shafi",
    supervisor: "Abdulla Sheikh",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  DSO: {
    tl: "Rashid",
    supervisor: "Jamil Akhtar",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "DSO 2": {
    tl: "Rashid",
    supervisor: "Jamil Akhtar",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "DSO 3": {
    tl: "Rashid",
    supervisor: "Jamil Akhtar",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Arabian Ranches 3": {
    tl: "Rashid",
    supervisor: "Jamil Akhtar",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Wadi Al Safa 5 - Dubailand": {
    tl: "Rao Abdulla",
    supervisor: "Jamil Akhtar",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  Majan: {
    tl: "Rao Abdulla",
    supervisor: "Jamil Akhtar",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  Liwan: {
    tl: "Rao Abdulla",
    supervisor: "Jamil Akhtar",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Nad Al Sheba": {
    tl: "Rao Abdulla",
    supervisor: "Jamil Akhtar",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  "Dubai Land 2": {
    tl: "Rao Abdulla",
    supervisor: "Jamil Akhtar",
    am: "Kiran Anand",
    cityManager: "Hamza Khan",
  },
  // ── HAMZA KHAN — Safraj / Amit Sah ──────────────────────────────────────
  "Business Bay": {
    tl: "Numan",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Meydan 2": {
    tl: "Numan",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Business Bay 2": {
    tl: "Numan",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Downtown Dubai": {
    tl: "Majid",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Dubai Mall Zabeel": {
    tl: "Majid",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Sobha Hartland": {
    tl: "Majid",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Motor City": {
    tl: "Asif",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Production City": {
    tl: "Asif",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Dubai Studio City": {
    tl: "Asif",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Dubai Sports City": {
    tl: "Asif",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Motor City 2": {
    tl: "Asif",
    supervisor: "Safraj",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  // ── HAMZA KHAN — Saifullah / Amit Sah ───────────────────────────────────
  "Dubai Hills": {
    tl: "Nadeem Ghulam",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Umm Suqeim": {
    tl: "Nadeem Ghulam",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Satwa": {
    tl: "Nadeem Ghulam",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Quoz 2": {
    tl: "Nadeem Ghulam",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Quoz 3": {
    tl: "Nadeem Ghulam",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Wasl": {
    tl: "Bilal",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  Jumeirah: {
    tl: "Bilal",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Quoz 4": {
    tl: "Bilal",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Satwa 2": {
    tl: "Bilal",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Satwa 3": {
    tl: "Bilal",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Badaa": {
    tl: "Bilal",
    supervisor: "Saifullah",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  // ── HAMZA KHAN — Kul Rana / Amit Sah ────────────────────────────────────
  "Jumairah Village Circle": {
    tl: "Shayan",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Arjan 2": {
    tl: "Shayan",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Arjan 3": {
    tl: "Shayan",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "JVC 3": {
    tl: "Shayan",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "JVC 4": {
    tl: "Shayan",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "JVC 5": {
    tl: "Shayan",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Town Square": {
    tl: "Imamuddin",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Damac Hills 2": {
    tl: "Imamuddin",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Town Square 2": {
    tl: "Imamuddin",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  JVC: {
    tl: "Imamuddin",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Barsha Third": {
    tl: "Imamuddin",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Arjan 4": {
    tl: "Imamuddin",
    supervisor: "Kul Rana",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  // ── HAMZA KHAN — Abhishek / Amit Sah ────────────────────────────────────
  Marina: {
    tl: "Bala Saheb",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Dubai Marina 2": {
    tl: "Bala Saheb",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Dubai South": {
    tl: "Bala Saheb",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Marina 3": {
    tl: "Bala Saheb",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "DIP 2": {
    tl: "Bala Saheb",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Marina 4": {
    tl: "Balasaheb",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Dubai Investments Park": {
    tl: "Ayush",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Jebel Ali Village - Dubai": {
    tl: "Ayush",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  Furjan: {
    tl: "Ayush",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Dubai Industrial City": {
    tl: "Ayush",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Jabal Ali Industrial First": {
    tl: "Ayush",
    supervisor: "Abhishek",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  // ── HAMZA KHAN — Arnel Samaniego / Amit Sah ─────────────────────────────
  JLT: {
    tl: "Ahmad Sardar",
    supervisor: "Arnel Samaniego",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Barsha": {
    tl: "Ahmad Sardar",
    supervisor: "Arnel Samaniego",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Emirates Hills": {
    tl: "Ahmad Sardar",
    supervisor: "Arnel Samaniego",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Dubai Media City": {
    tl: "Ahmad Sardar",
    supervisor: "Arnel Samaniego",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Barsha 2": {
    tl: "Ahmad Sardar",
    supervisor: "Arnel Samaniego",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Barsha Heights - Tecom": {
    tl: "Ahmad Sardar",
    supervisor: "Arnel Samaniego",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Barsha Heights 2": {
    tl: "Ahmad Sardar",
    supervisor: "Arnel Samaniego",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  "Al Barsha 3": {
    tl: "Ahmad Sardar",
    supervisor: "Arnel Samaniego",
    am: "Amit Sah",
    cityManager: "Hamza Khan",
  },
  // ── KANISHAK AGARWALL — Priyabrata Parida / Laxminarayan ────────────────
  "Al Hamriya": {
    tl: "NTH",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Al Karama": {
    tl: "NTH",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Al Mankhoul": {
    tl: "NTH",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Al Mankhoul 2": {
    tl: "NTH",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Bur Dubai": {
    tl: "NTH",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Bur Dubai 3": {
    tl: "NTH",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Fujairah – Al Muntazah": {
    tl: "Abrar Husain Pathan",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  Khorfakkan: {
    tl: "Abrar Husain Pathan",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Al Hamra - RAK": {
    tl: "Om Shanker",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Naeem City center": {
    tl: "Om Shanker",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "RAK Al Nakheel": {
    tl: "Om Shanker",
    supervisor: "Priyabrata Parida",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  // ── KANISHAK AGARWALL — Sandip Soni / Laxminarayan ──────────────────────
  "Al Jeddaf": {
    tl: "Kuldip Kumar",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Dubai Healthcare City": {
    tl: "Kuldip Kumar",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Hor Al Anz": {
    tl: "Kuldip Kumar",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Hor Al Anz 2": {
    tl: "Kuldip Kumar",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Oud Metha": {
    tl: "Kuldip Kumar",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  Deira: {
    tl: "Mohsin Khan",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Deira 2": {
    tl: "Mohsin Khan",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Deira 3": {
    tl: "Mohsin Khan",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Deira 4": {
    tl: "Mohsin Khan",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  "Deira 5": {
    tl: "Mohsin Khan",
    supervisor: "Sandip Soni",
    am: "Laxminarayan",
    cityManager: "Kanishak Agarwall",
  },
  // ── KANISHAK AGARWALL — Ashish Singh / NTH ──────────────────────────────
  "Al Fisht": {
    tl: "Muhammad Abid",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Nasserya": {
    tl: "Muhammad Abid",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Qasimia": {
    tl: "Muhammad Abid",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Qasimia 2": {
    tl: "Muhammad Abid",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Abu Shaghara": {
    tl: "Muhammad Abid",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Muwaileh 2": {
    tl: "Irfan Mirza",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Muwaileh 3": {
    tl: "Irfan Mirza",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  Muweilah: {
    tl: "Irfan Mirza",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Tay East": {
    tl: "Irfan Mirza",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Sharjah Industrial Area 6": {
    tl: "Muhammad Abid",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Majaz": {
    tl: "Osama Mohamed Abobakar Ibrahim",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Majaz 2": {
    tl: "Osama Mohamed Abobakar Ibrahim",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Majaz 3": {
    tl: "Osama Mohamed Abobakar Ibrahim",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Majaz 4": {
    tl: "Osama Mohamed Abobakar Ibrahim",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Nahda 2 - Sharjah": {
    tl: "Osama Mohamed Abobakar Ibrahim",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Taawun": {
    tl: "Osama Mohamed Abobakar Ibrahim",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Nahda Sharjah": {
    tl: "Osama Mohamed Abobakar Ibrahim",
    supervisor: "Ashish Singh",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  // ── KANISHAK AGARWALL — Padmakar / NTH ──────────────────────────────────
  "Al Hamidiya": {
    tl: "Abrar Husain Pathan",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Muwaihat": {
    tl: "Abrar Husain Pathan",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Nuaimia 1": {
    tl: "Abrar Husain Pathan",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Rawda 3": {
    tl: "Abrar Husain Pathan",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  Rumeilah: {
    tl: "Abrar Husain Pathan",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Jurf": {
    tl: "Om Shanker",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Salamah": {
    tl: "Om Shanker",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Yasmeen": {
    tl: "Om Shanker",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Al Zahya - Ajman": {
    tl: "Om Shanker",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  "Green Belt - Al Madr 2": {
    tl: "Om Shanker",
    supervisor: "Padmakar",
    am: "NTH",
    cityManager: "Kanishak Agarwall",
  },
  // ── SACHIN WADHVANE — Abdul Gafar Kerur / Manikandan Vasu ───────────────
  "Al Bateen": {
    tl: "Mohammad Zahid",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Manhal": {
    tl: "Mohammad Zahid",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Mushrif": {
    tl: "Mohammad Zahid",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Nahyan": {
    tl: "Mohammad Zahid",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Nahyan 3": {
    tl: "Mohammad Zahid",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Danah": {
    tl: "Saad Khan",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Khalidiyah": {
    tl: "Saad Khan",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Reem Island": {
    tl: "Saad Khan",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Zahiyah": {
    tl: "Saad Khan",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Zahiyah 2": {
    tl: "Saad Khan",
    supervisor: "Abdul Gafar Kerur",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Forsan Village": {
    tl: "Syed Shahzaib",
    supervisor: "Mohammad Arif",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  // ── SACHIN WADHVANE — Mohammad Arif / NTH ───────────────────────────────
  "Khalifa City": {
    tl: "Syed Shahzaib",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Khalifa City 2": {
    tl: "Syed Shahzaib",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Khalifa City 3": {
    tl: "Syed Shahzaib",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Mohamed Bin Zayed city": {
    tl: "Syed Shahzaib",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Mohamed Bin Zayed City 2": {
    tl: "Syed Shahzaib",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Al Mafraq": {
    tl: "Mursaleen Khan",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Al Rawdah": {
    tl: "Mursaleen Khan",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Al Saadah": {
    tl: "Mursaleen Khan",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Bani Yas": {
    tl: "Mursaleen Khan",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Bani Yas 2": {
    tl: "Mursaleen Khan",
    supervisor: "Mohammad Arif",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  // ── SACHIN WADHVANE — Nimesh / NTH ──────────────────────────────────────
  "Al Falah": {
    tl: "Amandeep Singh",
    supervisor: "Nimesh",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Raha Beach": {
    tl: "Amandeep Singh",
    supervisor: "Nimesh",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  Shahamah: {
    tl: "Amandeep Singh",
    supervisor: "Nimesh",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Zayed City": {
    tl: "Amandeep Singh",
    supervisor: "Nimesh",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Al Shamkha": {
    tl: "Amer Javed",
    supervisor: "Nimesh",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Al Shamkha 2": {
    tl: "Amer Javed",
    supervisor: "Nimesh",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Al Shamkha 3": {
    tl: "Amer Javed",
    supervisor: "Nimesh",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "AL Shawamekh": {
    tl: "Amer Javed",
    supervisor: "Nimesh",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  "Shakhbout 2": {
    tl: "Amer Javed",
    supervisor: "Nimesh",
    am: "NTH",
    cityManager: "Sachin Wadhvane",
  },
  // ── SACHIN WADHVANE — Roopesh / Manikandan Vasu ─────────────────────────
  "Al Ain - Nasseruya": {
    tl: "NTH",
    supervisor: "Roopesh",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Al Mu'tarid": {
    tl: "NTH",
    supervisor: "Roopesh",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "Souq extra": {
    tl: "NTH",
    supervisor: "Roopesh",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
  "WAHA MALL – AL AIN": {
    tl: "NTH",
    supervisor: "Roopesh",
    am: "Manikandan Vasu",
    cityManager: "Sachin Wadhvane",
  },
};

let STORE_NAMES = Object.keys(STORE_MAPPING);
// Country-aware, collision-safe list: each row carries its own country. The
// hardcoded fallback is all UAE. Built from the live ?stores `stores[]` payload.
interface StoreRow {
  country: string;
  store: string;
  tl: string;
  supervisor: string;
  am: string;
  cityManager: string;
}
let STORE_ROWS: StoreRow[] = STORE_NAMES.map((s) => ({
  country: "UAE",
  store: s,
  tl: STORE_MAPPING[s].tl,
  supervisor: STORE_MAPPING[s].supervisor,
  am: STORE_MAPPING[s].am,
  cityManager: STORE_MAPPING[s].cityManager,
}));
// A store's country (defaults to UAE for legacy/hardcoded entries).
function storeCountry(store: string): string {
  return normCountry(STORE_MAPPING[store] && STORE_MAPPING[store].country);
}
const SECTIONS = [
  {
    id: "inside",
    label: "Inside Dark Store",
    sub: "noon minutes facility",
    icon: "inside",
    max: 5,
  },
  {
    id: "outside",
    label: "Outside Dark Store",
    sub: "noon minutes frontage",
    icon: "outside",
    max: 5,
  },
  {
    id: "parking",
    label: "Parking & Rider Zone",
    sub: "noon delivery fleet",
    icon: "parking",
    max: 5,
  },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
const SHIFT_START = 8; // first slot: 8 AM
const SHIFT_END = 23; // last slot is 10 PM (22:00); its window runs until 11 PM (23:00)
const TOTAL_SHIFT_SLOTS = 15; // 8 AM, 9 AM … 10 PM = 15 hourly slots

// ── COUNTRIES ─────────────────────────────────────────────────────────────
// The 8 AM–10 PM shift is the same in every country, but the clock differs:
// slots and adherence are computed in each country's LOCAL time via its fixed
// UTC offset (none of these observe DST). UAE is the default so all existing
// data/users keep working unchanged.
const DEFAULT_COUNTRY = "UAE";
const COUNTRIES = ["UAE", "KSA", "Egypt", "Bahrain", "Qatar", "Kuwait"] as const;
type Country = (typeof COUNTRIES)[number];
const COUNTRY_UTC_OFFSET: Record<string, number> = {
  UAE: 4, KSA: 3, Bahrain: 3, Qatar: 3, Kuwait: 3, Egypt: 2,
};
function normCountry(v?: string): string {
  const s = String(v || "").trim();
  if (!s) return DEFAULT_COUNTRY;
  const hit = COUNTRIES.find((c) => c.toLowerCase() === s.toLowerCase());
  return hit || s;
}
// "Now" as a Date shifted into the given country's wall-clock, so getHours()/
// getDate() read that country's local time regardless of the device timezone.
function nowInCountry(country?: string): Date {
  const off = COUNTRY_UTC_OFFSET[normCountry(country)];
  if (off === undefined) return new Date();
  const now = new Date();
  return new Date(now.getTime() + (off * 60 + now.getTimezoneOffset()) * 60000);
}

const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyiJJaYSiTuYnjuM_L3Ejwp1mDdp8el0g--MO4FRf0RJ-lLsCsB4oTxd0CPKTNlijmxPQ/exec";
const THRESHOLD = 90;

// Fetch the live store list + POC mapping from the store-list sheet (served by
// Apps Script at ?stores). Fallback chain:
//   1. Live fetch (sheet) — the source of truth
//   2. Last successful fetch, cached in the browser (localStorage)
//   3. Hard-coded list above — only on a first-ever load with no connectivity
// On every successful fetch we cache the result, so the app stays current even
// when the sheet is briefly unreachable.
const STORE_CACHE_KEY = "ds_store_mapping_v2";

// Prefer the country-aware `stores[]` payload; fall back to legacy order/mapping
// (treated as all UAE) so an old backend still works.
function applyStoreMapping(
  order: string[],
  mapping: Record<string, any>,
  stores?: any[]
) {
  const m: Record<string, StoreInfo> = {};
  if (Array.isArray(stores) && stores.length) {
    const names: string[] = [];
    const rows: StoreRow[] = [];
    stores.forEach((r) => {
      const info: StoreInfo = {
        tl: r.tl || "",
        supervisor: r.supervisor || "",
        am: r.am || "",
        cityManager: r.cityManager || "",
        country: normCountry(r.country),
      };
      m[r.store] = info; // name-keyed for POC lookup (country-selected upload)
      names.push(r.store);
      rows.push({ country: info.country!, store: r.store, tl: info.tl, supervisor: info.supervisor, am: info.am, cityManager: info.cityManager });
    });
    STORE_MAPPING = m;
    STORE_NAMES = names;
    STORE_ROWS = rows;
    return;
  }
  order.forEach((s: string) => {
    const r = mapping[s] || {};
    m[s] = {
      tl: r.tl || "",
      supervisor: r.supervisor || "",
      am: r.am || "",
      cityManager: r.cityManager || "",
      country: DEFAULT_COUNTRY,
    };
  });
  STORE_MAPPING = m;
  STORE_NAMES = order.slice();
  STORE_ROWS = order.map((s) => ({ country: DEFAULT_COUNTRY, store: s, tl: m[s].tl, supervisor: m[s].supervisor, am: m[s].am, cityManager: m[s].cityManager }));
}

// Seed from the last successful fetch (if any) BEFORE the network call, so even
// the very first render uses the most recent known list rather than the older
// hard-coded one. Falls through to hard-coded if nothing is cached.
function seedStoreMappingFromCache(): boolean {
  try {
    const raw = localStorage.getItem(STORE_CACHE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.stores) && data.stores.length > 0) {
      applyStoreMapping(data.order || [], data.mapping || {}, data.stores);
      return true;
    }
    if (
      data &&
      data.mapping &&
      Array.isArray(data.order) &&
      data.order.length > 0
    ) {
      applyStoreMapping(data.order, data.mapping);
      return true;
    }
  } catch {}
  return false;
}

async function loadLiveStoreMapping(): Promise<boolean> {
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?stores=1`);
    const data = await res.json();
    const hasStores = data && Array.isArray(data.stores) && data.stores.length > 0;
    const hasLegacy = data && data.mapping && Array.isArray(data.order) && data.order.length > 0;
    if (hasStores || hasLegacy) {
      applyStoreMapping(data.order || [], data.mapping || {}, data.stores);
      // Cache this successful fetch as the fallback for next time
      try {
        localStorage.setItem(
          STORE_CACHE_KEY,
          JSON.stringify({
            mapping: data.mapping,
            order: data.order,
            stores: data.stores,
            savedAt: Date.now(),
          })
        );
      } catch {}
      return true;
    }
  } catch (e) {
    console.warn(
      "Live store mapping unavailable — using last cached / fallback list",
      e
    );
  }
  return false;
}

// ── USER ACCOUNTS & ROLES ─────────────────────────────────────────────────
// NOTE: This is internal-tool access control, not bank-grade security.
// Credentials live in the app bundle, so treat them as "casual access
// control + data scoping" rather than secret. Change passwords here anytime.
//
// ROLE MODEL:
//   Admin = full access to all stores
//   L1    = City Managers AND Supervisors — scoped to their own stores
//   L2    = Team Leaders — see ALL stores under their supervisor (incl. sibling TLs)
// Everyone can export.
type Role = "Admin" | "L1" | "L2";
interface UserAccount {
  username: string;
  password: string;
  role: Role;
  name: string;
  scopeType: "all" | "cityManager" | "supervisor" | "teamLeader";
  scopeValue?: string;
  // Countries this account may see. Absent = all countries (keeps the built-in
  // UAE accounts working unchanged, since their stores are UAE-only anyway).
  countries?: string[];
}

// The countries a user is entitled to (defaults to all when unset).
function userCountries(user: UserAccount): string[] {
  return user.countries && user.countries.length
    ? user.countries.map((c) => normCountry(c))
    : (COUNTRIES as readonly string[]).slice();
}

const USERS: UserAccount[] = [
  // ── ADMIN — full access ──
  {
    username: "admin",
    password: "noon@2026",
    role: "Admin",
    name: "Admin",
    scopeType: "all",
  },
  {
    username: "hamza",
    password: "hamza@123",
    role: "Admin",
    name: "Hamza Khan",
    scopeType: "all",
  },

  // ── L1 City Managers — scoped to their own stores ──
  {
    username: "hamza.cm",
    password: "hamzacm@123",
    role: "L1",
    name: "Hamza Khan (CM)",
    scopeType: "cityManager",
    scopeValue: "Hamza Khan",
  },
  {
    username: "kanishak",
    password: "kanishak@123",
    role: "L1",
    name: "Kanishak Agarwall",
    scopeType: "cityManager",
    scopeValue: "Kanishak Agarwall",
  },
  {
    username: "sachin",
    password: "sachin@123",
    role: "L1",
    name: "Sachin Wadhvane",
    scopeType: "cityManager",
    scopeValue: "Sachin Wadhvane",
  },

  // ── L1 Supervisors — scoped to their own stores ──
  {
    username: "nitesh",
    password: "nitesh@123",
    role: "L1",
    name: "Nitesh Nair",
    scopeType: "supervisor",
    scopeValue: "Nitesh Nair",
  },
  {
    username: "kulrana",
    password: "kul@123",
    role: "L1",
    name: "Kul Rana",
    scopeType: "supervisor",
    scopeValue: "Kul Rana",
  },
  {
    username: "safraj",
    password: "safraj@123",
    role: "L1",
    name: "Safraj",
    scopeType: "supervisor",
    scopeValue: "Safraj",
  },
  {
    username: "saifullah",
    password: "saif@123",
    role: "L1",
    name: "Saifullah",
    scopeType: "supervisor",
    scopeValue: "Saifullah",
  },
  {
    username: "abhishek",
    password: "abhishek@123",
    role: "L1",
    name: "Abhishek",
    scopeType: "supervisor",
    scopeValue: "Abhishek",
  },
  {
    username: "arnel",
    password: "arnel@123",
    role: "L1",
    name: "Arnel Samaniego",
    scopeType: "supervisor",
    scopeValue: "Arnel Samaniego",
  },
  {
    username: "jamil",
    password: "jamil@123",
    role: "L1",
    name: "Jamil Akhtar",
    scopeType: "supervisor",
    scopeValue: "Jamil Akhtar",
  },
  {
    username: "abdulla",
    password: "abdulla@123",
    role: "L1",
    name: "Abdulla Sheikh",
    scopeType: "supervisor",
    scopeValue: "Abdulla Sheikh",
  },
  {
    username: "priyabrata",
    password: "priya@123",
    role: "L1",
    name: "Priyabrata Parida",
    scopeType: "supervisor",
    scopeValue: "Priyabrata Parida",
  },
  {
    username: "sandip",
    password: "sandip@123",
    role: "L1",
    name: "Sandip Soni",
    scopeType: "supervisor",
    scopeValue: "Sandip Soni",
  },
  {
    username: "ashish",
    password: "ashish@123",
    role: "L1",
    name: "Ashish Singh",
    scopeType: "supervisor",
    scopeValue: "Ashish Singh",
  },
  {
    username: "padmakar",
    password: "padmakar@123",
    role: "L1",
    name: "Padmakar",
    scopeType: "supervisor",
    scopeValue: "Padmakar",
  },
  {
    username: "gafar",
    password: "gafar@123",
    role: "L1",
    name: "Abdul Gafar Kerur",
    scopeType: "supervisor",
    scopeValue: "Abdul Gafar Kerur",
  },
  {
    username: "arif",
    password: "arif@123",
    role: "L1",
    name: "Mohammad Arif",
    scopeType: "supervisor",
    scopeValue: "Mohammad Arif",
  },
  {
    username: "nimesh",
    password: "nimesh@123",
    role: "L1",
    name: "Nimesh",
    scopeType: "supervisor",
    scopeValue: "Nimesh",
  },
  {
    username: "roopesh",
    password: "roopesh@123",
    role: "L1",
    name: "Roopesh",
    scopeType: "supervisor",
    scopeValue: "Roopesh",
  },

  // ── L2 Team Leaders — see ALL stores under their supervisor ──
  {
    username: "tl.abhishekshafi",
    password: "tl@123",
    role: "L2",
    name: "Abhishek Shafi",
    scopeType: "teamLeader",
    scopeValue: "Abhishek Shafi",
  },
  {
    username: "tl.abrar",
    password: "tl@123",
    role: "L2",
    name: "Abrar Husain Pathan",
    scopeType: "teamLeader",
    scopeValue: "Abrar Husain Pathan",
  },
  {
    username: "tl.ahmad",
    password: "tl@123",
    role: "L2",
    name: "Ahmad Sardar",
    scopeType: "teamLeader",
    scopeValue: "Ahmad Sardar",
  },
  {
    username: "tl.amandeep",
    password: "tl@123",
    role: "L2",
    name: "Amandeep Singh",
    scopeType: "teamLeader",
    scopeValue: "Amandeep Singh",
  },
  {
    username: "tl.amer",
    password: "tl@123",
    role: "L2",
    name: "Amer Javed",
    scopeType: "teamLeader",
    scopeValue: "Amer Javed",
  },
  {
    username: "tl.asif",
    password: "tl@123",
    role: "L2",
    name: "Asif",
    scopeType: "teamLeader",
    scopeValue: "Asif",
  },
  {
    username: "tl.ayush",
    password: "tl@123",
    role: "L2",
    name: "Ayush",
    scopeType: "teamLeader",
    scopeValue: "Ayush",
  },
  {
    username: "tl.balasaheb",
    password: "tl@123",
    role: "L2",
    name: "Bala Saheb",
    scopeType: "teamLeader",
    scopeValue: "Bala Saheb",
  },
  {
    username: "tl.bilal",
    password: "tl@123",
    role: "L2",
    name: "Bilal",
    scopeType: "teamLeader",
    scopeValue: "Bilal",
  },
  {
    username: "tl.imamuddin",
    password: "tl@123",
    role: "L2",
    name: "Imamuddin",
    scopeType: "teamLeader",
    scopeValue: "Imamuddin",
  },
  {
    username: "tl.irfan",
    password: "tl@123",
    role: "L2",
    name: "Irfan Mirza",
    scopeType: "teamLeader",
    scopeValue: "Irfan Mirza",
  },
  {
    username: "tl.kuldip",
    password: "tl@123",
    role: "L2",
    name: "Kuldip Kumar",
    scopeType: "teamLeader",
    scopeValue: "Kuldip Kumar",
  },
  {
    username: "tl.majid",
    password: "tl@123",
    role: "L2",
    name: "Majid",
    scopeType: "teamLeader",
    scopeValue: "Majid",
  },
  {
    username: "tl.zahid",
    password: "tl@123",
    role: "L2",
    name: "Mohammad Zahid",
    scopeType: "teamLeader",
    scopeValue: "Mohammad Zahid",
  },
  {
    username: "tl.mohsin",
    password: "tl@123",
    role: "L2",
    name: "Mohsin Khan",
    scopeType: "teamLeader",
    scopeValue: "Mohsin Khan",
  },
  {
    username: "tl.abid",
    password: "tl@123",
    role: "L2",
    name: "Muhammad Abid",
    scopeType: "teamLeader",
    scopeValue: "Muhammad Abid",
  },
  {
    username: "tl.mursaleen",
    password: "tl@123",
    role: "L2",
    name: "Mursaleen Khan",
    scopeType: "teamLeader",
    scopeValue: "Mursaleen Khan",
  },
  {
    username: "tl.nadeem",
    password: "tl@123",
    role: "L2",
    name: "Nadeem Ghulam",
    scopeType: "teamLeader",
    scopeValue: "Nadeem Ghulam",
  },
  {
    username: "tl.numan",
    password: "tl@123",
    role: "L2",
    name: "Numan",
    scopeType: "teamLeader",
    scopeValue: "Numan",
  },
  {
    username: "tl.omshanker",
    password: "tl@123",
    role: "L2",
    name: "Om Shanker",
    scopeType: "teamLeader",
    scopeValue: "Om Shanker",
  },
  {
    username: "tl.osama",
    password: "tl@123",
    role: "L2",
    name: "Osama Mohamed Abobakar Ibrahim",
    scopeType: "teamLeader",
    scopeValue: "Osama Mohamed Abobakar Ibrahim",
  },
  {
    username: "tl.rao",
    password: "tl@123",
    role: "L2",
    name: "Rao Abdulla",
    scopeType: "teamLeader",
    scopeValue: "Rao Abdulla",
  },
  {
    username: "tl.rashid",
    password: "tl@123",
    role: "L2",
    name: "Rashid",
    scopeType: "teamLeader",
    scopeValue: "Rashid",
  },
  {
    username: "tl.saad",
    password: "tl@123",
    role: "L2",
    name: "Saad Khan",
    scopeType: "teamLeader",
    scopeValue: "Saad Khan",
  },
  {
    username: "tl.salman",
    password: "tl@123",
    role: "L2",
    name: "Salman Haider",
    scopeType: "teamLeader",
    scopeValue: "Salman Haider",
  },
  {
    username: "tl.shayan",
    password: "tl@123",
    role: "L2",
    name: "Shayan",
    scopeType: "teamLeader",
    scopeValue: "Shayan",
  },
  {
    username: "tl.sivaprakash",
    password: "tl@123",
    role: "L2",
    name: "Sivaprakash",
    scopeType: "teamLeader",
    scopeValue: "Sivaprakash",
  },
  {
    username: "tl.soleman",
    password: "tl@123",
    role: "L2",
    name: "Soleman",
    scopeType: "teamLeader",
    scopeValue: "Soleman",
  },
  {
    username: "tl.shahzaib",
    password: "tl@123",
    role: "L2",
    name: "Syed Shahzaib",
    scopeType: "teamLeader",
    scopeValue: "Syed Shahzaib",
  },
];

function authenticate(username: string, password: string): UserAccount | null {
  const u = USERS.find(
    (x) =>
      x.username.toLowerCase() === username.toLowerCase().trim() &&
      x.password === password
  );
  return u || null;
}

// Log in against the central Users sheet first (so accounts are managed there
// without redeploys), then fall back to the built-in accounts — which keeps the
// existing UAE logins working and lets people sign in offline. The backend
// returns only the matched account's scope, never other users or passwords.
async function loginAccount(
  username: string,
  password: string
): Promise<UserAccount | null> {
  try {
    const url =
      `${GOOGLE_SCRIPT_URL}?login=1&u=${encodeURIComponent(username.trim())}` +
      `&p=${encodeURIComponent(password)}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j && j.ok && j.user) {
      const su = j.user;
      return {
        username: su.username || username.trim(),
        password: "",
        role: (su.role as Role) || "L1",
        name: su.name || su.username || username.trim(),
        scopeType: su.scopeType || "all",
        scopeValue: su.scopeValue || "",
        countries: Array.isArray(su.countries)
          ? su.countries.map((c: string) => normCountry(c))
          : undefined,
      };
    }
  } catch {
    /* backend unreachable — fall through to built-in accounts */
  }
  return authenticate(username, password);
}
// Returns the set of store names a user is allowed to see
// Normalize names for matching — trims whitespace and lowercases — so sheet
// typos like "Hamza khan" vs "Hamza Khan " all match the same person/store.
function norm(v?: string): string {
  return String(v || "")
    .trim()
    .toLowerCase();
}

// Stores a user may see = (role scope) ∩ (their countries). The country filter
// is applied LAST so it also bounds a "country admin" (scopeType 'all' with a
// specific countries list) to just their countries.
function getScopedStores(user: UserAccount): string[] {
  const cset = new Set(userCountries(user).map(norm));
  const inCountry = (s: string) => cset.has(norm(storeCountry(s)));

  let byRole: string[];
  if (user.scopeType === "all") {
    byRole = STORE_NAMES.slice();
  } else {
    const want = norm(user.scopeValue);
    if (user.scopeType === "cityManager") {
      byRole = STORE_NAMES.filter((s) => norm(STORE_MAPPING[s].cityManager) === want);
    } else if (user.scopeType === "supervisor") {
      byRole = STORE_NAMES.filter((s) => norm(STORE_MAPPING[s].supervisor) === want);
    } else if (user.scopeType === "teamLeader") {
      // TL sees ALL stores under their supervisor(s), including sibling TLs.
      const mySupervisors = Array.from(
        new Set(
          STORE_NAMES.filter((s) => norm(STORE_MAPPING[s].tl) === want).map((s) =>
            norm(STORE_MAPPING[s].supervisor)
          )
        )
      );
      byRole = STORE_NAMES.filter((s) =>
        mySupervisors.includes(norm(STORE_MAPPING[s].supervisor))
      );
    } else {
      byRole = [];
    }
  }
  return byRole.filter(inCountry);
}
function loadSession(): UserAccount | null {
  try {
    const s = localStorage.getItem("ds_session");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
function saveSession(u: UserAccount | null) {
  if (u) localStorage.setItem("ds_session", JSON.stringify(u));
  else localStorage.removeItem("ds_session");
}

// ── FIX 1: Hardcoded date format — consistent across ALL devices/locales ──
function fmtDate(iso: string) {
  const d = new Date(iso);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${String(d.getDate()).padStart(2, "0")} ${
    months[d.getMonth()]
  } ${d.getFullYear()}`;
}

// ── FIX 2: extractDate handles ISO timestamps from Sheet ──────────────────
function extractDate(val: string) {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${String(d.getDate()).padStart(2, "0")} ${
      months[d.getMonth()]
    } ${d.getFullYear()}`;
  } catch {
    return val;
  }
}

function extractHourSlot(val: string) {
  if (!val) return val;
  const s = String(val).trim();
  // If it's already a clean slot like "8:00 AM" / "12:00 PM", return as-is
  if (/^\d{1,2}:00\s?(AM|PM)$/i.test(s))
    return s.toUpperCase().replace(/\s+/, " ");
  // Only an actual ISO timestamp (contains "T") needs parsing — and HourSlot
  // timestamps were stored as UAE local wall-clock, so read local hours, not UTC
  if (s.includes("T")) {
    try {
      const d = new Date(s);
      const h = d.getHours();
      return `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;
    } catch {
      return s;
    }
  }
  return s;
}
function getCurrentHourLabel(country?: string) {
  const h = nowInCountry(country).getHours();
  return `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;
}
// Convert a slot label like "3:00 PM" / "12:00 PM" to its 24h hour number (0-23).
// Returns -1 if unparseable. Used for robust heatmap matching (no string compare).
function slotLabelToHour(label: string): number {
  const m = String(label)
    .trim()
    .match(/^(\d{1,2}):00\s?(AM|PM)$/i);
  if (!m) return -1;
  let h = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[2])) h += 12;
  return h;
}
function getLast7Dates(days = 7) {
  const d: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const x = new Date();
    x.setDate(x.getDate() - i);
    d.push(fmtDate(x.toISOString()));
  }
  return d;
}
// Slots elapsed on a given date. For "today" it's computed in the country's
// local time (so a store in KSA/Egypt isn't judged against UAE's clock).
function getElapsedSlots(dateStr: string, country?: string): number {
  const now = nowInCountry(country);
  const today = fmtDate(now.toISOString());
  if (dateStr === today) {
    const nowHour = now.getHours();
    if (nowHour < SHIFT_START) return 0;
    if (nowHour >= SHIFT_END) return TOTAL_SHIFT_SLOTS;
    return nowHour - SHIFT_START;
  }
  return TOTAL_SHIFT_SLOTS;
}
function getTotalExpected(dates: string[], stores: number): number {
  return dates.reduce((acc, date) => acc + getElapsedSlots(date) * stores, 0);
}
// Country-aware expected slots: each store is judged in ITS country's timezone,
// so a mixed-country store set sums correctly (a KSA store's "today" elapses on
// a different clock than a UAE store's).
function expectedSlots(dates: string[], storeList: string[]): number {
  let total = 0;
  for (let i = 0; i < dates.length; i++) {
    for (let j = 0; j < storeList.length; j++) {
      total += getElapsedSlots(dates[i], storeCountry(storeList[j]));
    }
  }
  return total;
}
function getDayLabel(s: string) {
  try {
    return new Date(s).toLocaleDateString("en-AE", { weekday: "short" });
  } catch {
    return s;
  }
}
function adColor(p: number) {
  return p >= THRESHOLD ? "#4ADE80" : p >= 60 ? "#F5D000" : "#FF6B6B";
}
function loadSubmissions(): Submission[] {
  try {
    return JSON.parse(localStorage.getItem("ds_submissions") || "[]");
  } catch {
    return [];
  }
}
function saveSubmissions(list: Submission[]) {
  localStorage.setItem("ds_submissions", JSON.stringify(list));
}

// ── OFFLINE QUEUE (IndexedDB) ─────────────────────────────────────────────
// CRITICAL FIX: localStorage has a ~5MB limit — far too small for photo/video
// payloads (15 photos ≈ 7MB+, a single video can be 50MB+). That quota overflow
// was failing SILENTLY, which is why retries never happened and users had to
// retake everything. IndexedDB handles 50MB+ reliably, so queued submissions
// now persist on the device and can be retried without re-capturing anything.
interface QueuedItem {
  id: string;
  record: any;
  files: any[];
  queuedAt: string;
}

const IDB_NAME = "ds_db";
const IDB_STORE = "queue";
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE))
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbAdd(item: QueuedItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
async function idbGetAll(): Promise<QueuedItem[]> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result || []);
    };
    req.onerror = () => {
      db.close();
      resolve([]);
    };
  });
}
async function idbDelete(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}
async function idbCount(): Promise<number> {
  const items = await idbGetAll();
  return items.length;
}

// ── CHUNKED UPLOAD ORCHESTRATOR ────────────────────────────────────────────
// Structural fix for large-payload failures: instead of one giant request,
// upload each file in its own small request, confirm all landed, then write
// the Sheet row. Every step is idempotent so retries are always safe.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJSON(payload: any) {
  await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
  });
}

// Ask the server which of this record's files already landed. Returns the
// COUNT plus the SET of file indices present, so the retry loop can resend ONLY
// the missing units instead of blindly resending everything (the old behavior,
// which turned a single lagging file into a full re-upload of all 15 — a
// feedback loop that amplified overload at the top of every hour).
async function getServerPresence(
  record: any
): Promise<{ count: number; present: Set<number> }> {
  try {
    const u = `${GOOGLE_SCRIPT_URL}?fileCount=${encodeURIComponent(
      record.id
    )}&store=${encodeURIComponent(record.store)}&date=${encodeURIComponent(
      record.date
    )}&slot=${encodeURIComponent(record.hourSlot)}&country=${encodeURIComponent(
      record.country || DEFAULT_COUNTRY
    )}`;
    const r = await fetch(u);
    const j = await r.json();
    const present = new Set<number>(
      Array.isArray(j.indices) ? j.indices.map((n: any) => Number(n)) : []
    );
    return { count: j.count || present.size || 0, present };
  } catch {
    return { count: 0, present: new Set<number>() };
  }
}

const CHUNK_CHARS = 900000; // ~900KB of base64 per chunk (divisible by 4)
function chunkString(str: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}

// Run async tasks with bounded concurrency — fast (parallel) but capped so we
// never overwhelm the connection or Apps Script. Returns when all settle.
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let idx = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (idx < items.length) {
        const myIdx = idx++;
        try {
          await worker(items[myIdx]);
        } catch (e) {
          console.warn("pool task failed", e);
        }
      }
    }
  );
  await Promise.all(runners);
}

// Build the flat list of upload units. Photos = 1 unit each. Videos = 1 unit
// per ~900KB chunk. Each unit is a small, independent, idempotent request.
interface UploadUnit {
  kind: "file" | "chunk";
  fileIndex: number;
  file: any;
  chunkIndex?: number;
  totalChunks?: number;
  data?: string;
}
function buildUnits(files: any[]): {
  units: UploadUnit[];
  chunkPlan: Map<number, number>;
} {
  const units: UploadUnit[] = [];
  const chunkPlan = new Map<number, number>(); // fileIndex -> totalChunks (videos only)
  files.forEach((file, i) => {
    const b64 = file.base64 || "";
    if (b64.length <= CHUNK_CHARS) {
      units.push({ kind: "file", fileIndex: i, file });
    } else {
      const chunks = chunkString(b64, CHUNK_CHARS);
      chunkPlan.set(i, chunks.length);
      chunks.forEach((data, c) =>
        units.push({
          kind: "chunk",
          fileIndex: i,
          file,
          chunkIndex: c,
          totalChunks: chunks.length,
          data,
        })
      );
    }
  });
  return { units, chunkPlan };
}

async function sendUnit(record: any, u: UploadUnit) {
  if (u.kind === "file") {
    await postJSON({
      action: "addFile",
      recordId: record.id,
      country: record.country || DEFAULT_COUNTRY,
      store: record.store,
      date: record.date,
      hourSlot: record.hourSlot,
      section: u.file.section,
      index: u.fileIndex,
      fileName: u.file.name,
      mimeType: u.file.mimeType,
      base64: u.file.base64,
    });
  } else {
    await postJSON({
      action: "addChunk",
      recordId: record.id,
      country: record.country || DEFAULT_COUNTRY,
      store: record.store,
      date: record.date,
      hourSlot: record.hourSlot,
      fileIndex: u.fileIndex,
      chunkIndex: u.chunkIndex,
      totalChunks: u.totalChunks,
      data: u.data,
    });
  }
}

// Returns true if the submission fully landed (all files + Sheet row).
// Reliability model: every unit is idempotent server-side, and each retry round
// asks the server WHICH file indices are already present, then resends ONLY the
// missing ones (not everything). Combined with exponential backoff, this stops
// the old "one lagging file triggers a full re-upload" feedback loop that
// amplified load at the top of every hour.
async function uploadSubmission(record: any, files: any[]): Promise<boolean> {
  const total = files.length;
  const { units, chunkPlan } = buildUnits(files);
  const CONCURRENCY = 3;

  // Send only the units belonging to the given set of missing file indices
  // (or all units when `only` is null — used for the first pass).
  async function sendUnits(only: Set<number> | null) {
    const todo = only ? units.filter((u) => only.has(u.fileIndex)) : units;
    await runPool(todo, CONCURRENCY, (u) => sendUnit(record, u));
  }

  // Assemble chunked videos — but only the ones still missing on the server.
  async function assembleMissing(missing: Set<number> | null) {
    const videoIdxs = Array.from(chunkPlan.keys()).filter(
      (fi) => !missing || missing.has(fi)
    );
    await runPool(videoIdxs, CONCURRENCY, async (fi) => {
      const file = files[fi];
      await postJSON({
        action: "assembleFile",
        recordId: record.id,
        country: record.country || DEFAULT_COUNTRY,
        store: record.store,
        date: record.date,
        hourSlot: record.hourSlot,
        fileIndex: fi,
        totalChunks: chunkPlan.get(fi),
        fileName: file.name,
        mimeType: file.mimeType,
        section: file.section,
      });
    });
  }

  // 1. First pass: upload everything, then assemble any videos.
  await sendUnits(null);
  await assembleMissing(null);

  // 2. Confirm + targeted resend, up to 3 rounds with exponential backoff.
  let present = new Set<number>();
  for (let round = 0; round < 3; round++) {
    await sleep(2500 * Math.pow(1.6, round)); // 2.5s → 4s → 6.4s
    const p = await getServerPresence(record);
    present = p.present;
    if (p.count >= total) break;
    // Which of the expected file indices are still missing?
    const missing = new Set<number>();
    for (let i = 0; i < total; i++) if (!present.has(i)) missing.add(i);
    if (missing.size === 0) break;
    await sendUnits(missing);
    await assembleMissing(missing);
  }

  // 3. Finalize — write the Sheet row (idempotent server-side).
  await postJSON({ action: "finalize", ...record });

  // 4. Verify the row landed, with backoff.
  let ok = false;
  for (let vtries = 0; vtries < 3 && !ok; vtries++) {
    await sleep(vtries === 0 ? 4000 : 3500 * (vtries + 1));
    try {
      const c = await fetch(
        `${GOOGLE_SCRIPT_URL}?check=${record.id}&country=${encodeURIComponent(
          record.country || DEFAULT_COUNTRY
        )}`
      );
      const res = await c.json();
      ok = res.found === true;
    } catch {}
  }
  return ok;
}

// Inject keyframe animations once (fade-in, slide-up, spinner)
function injectAnimations() {
  if (document.getElementById("ds-anim")) return;
  const s = document.createElement("style");
  s.id = "ds-anim";
  s.textContent = `
    @keyframes dsFadeIn{from{opacity:0}to{opacity:1}}
    @keyframes dsSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes dsSpin{to{transform:rotate(360deg)}}
    @keyframes dsPulse{0%,100%{opacity:1}50%{opacity:0.5}}
    .ds-fade{animation:dsFadeIn 0.3s ease}
    .ds-slide{animation:dsSlideUp 0.35s ease}
    .ds-spin{animation:dsSpin 0.8s linear infinite}
    .ds-pulse{animation:dsPulse 1.5s ease infinite}
    .ds-card-hover{transition:transform 0.15s ease,border-color 0.15s ease}
    .ds-card-hover:active{transform:scale(0.98)}
  `;
  document.head.appendChild(s);
}

// Reusable AudioContext — created once, resumed on demand. Mobile browsers
// start the context "suspended" until a user gesture, so we resume it before
// each beep (and we also unlock it on first tap via the effect below).
let _audioCtx: any = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try {
      _audioCtx = new ((window as any).AudioContext ||
        (window as any).webkitAudioContext)();
    } catch (e) {
      return null;
    }
  }
  return _audioCtx;
}
function playAlertSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const beep = (f: number, s: number, d: number) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.4, ctx.currentTime + s);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s + d);
      o.start(ctx.currentTime + s);
      o.stop(ctx.currentTime + s + d);
    };
    beep(880, 0, 0.12);
    beep(880, 0.15, 0.12);
    beep(1100, 0.3, 0.25);
  } catch (e) {}
}

function NoonLogo() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: "#F5D000",
          letterSpacing: "-1.5px",
          lineHeight: 1,
        }}
      >
        noon
      </div>
      <div
        style={{
          background: "#E31E24",
          borderRadius: 4,
          border: "2px solid #1a1a1a",
          boxShadow: "2px 2px 0 #000",
          padding: "1px 7px 2px",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "1.5px",
            textTransform: "uppercase" as const,
            color: "#fff",
            fontStyle: "italic",
            lineHeight: 1.2,
            display: "block",
          }}
        >
          MINUTES
        </span>
      </div>
    </div>
  );
}

function SectionIcon({ type }: { type: string }) {
  const p = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#F5D000",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (type === "inside")
    return (
      <svg {...p} aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
        <rect
          x="10"
          y="4"
          width="4"
          height="4"
          rx="0.5"
          fill="#F5D000"
          stroke="none"
        />
      </svg>
    );
  if (type === "outside")
    return (
      <svg {...p} aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="1" />
        <path d="M2 7l10-5 10 5" />
        <line x1="12" y1="7" x2="12" y2="21" />
        <rect x="5" y="11" width="3" height="3" rx="0.3" stroke="#F5D000" />
        <rect x="16" y="11" width="3" height="3" rx="0.3" stroke="#F5D000" />
        <rect
          x="9.5"
          y="15"
          width="5"
          height="6"
          rx="0.3"
          fill="#F5D000"
          stroke="none"
        />
      </svg>
    );
  return (
    <svg {...p} aria-hidden="true">
      <circle cx="5.5" cy="17" r="2.5" />
      <circle cx="18.5" cy="17" r="2.5" />
      <path d="M8 17h6" />
      <path d="M14 17l-2-5h-3l-1-3H5" />
      <path d="M12 12h5l1.5 5" />
      <path d="M16 7h2l1 3" />
      <circle cx="17" cy="6" r="1" fill="#F5D000" stroke="none" />
    </svg>
  );
}

function PBar({ pct }: { pct: number }) {
  const c = adColor(pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          height: 6,
          background: "#333",
          borderRadius: 3,
          flex: 1,
          minWidth: 50,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 3,
            background: c,
            width: `${Math.min(pct, 100)}%`,
          }}
        />
      </div>
      <span style={{ color: c, fontWeight: 700, minWidth: 36, fontSize: 12 }}>
        {pct}%
      </span>
    </div>
  );
}

function AdBadge({ pct }: { pct: number }) {
  if (pct >= THRESHOLD)
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 20,
          background: "#1E3A1E",
          color: "#4ADE80",
        }}
      >
        Good
      </span>
    );
  if (pct >= 60)
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 20,
          background: "#3A2E1A",
          color: "#F5D000",
        }}
      >
        Watch
      </span>
    );
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 20,
        background: "#3A1A1A",
        color: "#FF6B6B",
      }}
    >
      ⚑ Flag
    </span>
  );
}

// ── UPLOAD VIEW ───────────────────────────────────────────────────────────
function UploadView() {
  // Country gates the store list; slots + shift are in the country's local time.
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const [store, setStore] = useState("");
  const [nowHour, setNowHour] = useState(nowInCountry(DEFAULT_COUNTRY).getHours());
  const [hourSlot, setHourSlot] = useState(getCurrentHourLabel(DEFAULT_COUNTRY));
  const [sections, setSections] = useState<Record<SectionId, FileItem[]>>({
    inside: [],
    outside: [],
    parking: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "failed" | "queued"
  >("idle");
  const [queueCount, setQueueCount] = useState(0);
  const [storeSearch, setStoreSearch] = useState("");
  const countRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapping = store ? STORE_MAPPING[store] : null;
  // Countries that actually have stores (fallback to the full list on first load
  // before the live store list arrives).
  const countryOptions = (() => {
    const set = Array.from(new Set(STORE_ROWS.map((r) => r.country)));
    return set.length ? set : (COUNTRIES as readonly string[]).slice();
  })();
  // Stores in the selected country, honoring the search box.
  const storesForCountry = STORE_NAMES.filter(
    (s) =>
      normCountry(storeCountry(s)) === normCountry(country) &&
      s.toLowerCase().includes(storeSearch.toLowerCase())
  );
  // Uploads allowed during slot windows: 8 AM through the 10 PM slot, which
  // stays open until 11 PM (nowHour 8..22 inclusive). At 11 PM (23) it closes.
  const withinShift = nowHour >= SHIFT_START && nowHour < SHIFT_END;

  // Keep the current hour fresh — re-check every 30s so the slot rolls over
  // automatically and uploads lock the moment an hour elapses. Computed in the
  // selected country's local time.
  useEffect(() => {
    const iv = setInterval(() => {
      setNowHour(nowInCountry(country).getHours());
      setHourSlot(getCurrentHourLabel(country));
    }, 30000);
    return () => clearInterval(iv);
  }, [country]);

  // On country change, re-stamp the slot immediately and clear the store pick
  // (its store list no longer applies).
  useEffect(() => {
    setNowHour(nowInCountry(country).getHours());
    setHourSlot(getCurrentHourLabel(country));
    setStore("");
    setStoreSearch("");
  }, [country]);

  // Unlock audio on the first user interaction (mobile browsers require a
  // gesture before any sound can play). After this, hourly alerts will sound.
  useEffect(() => {
    function unlock() {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === "suspended") ctx.resume();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    }
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    function startAlert() {
      setAlertVisible(true);
      setCountdown(120);
      setHourSlot(getCurrentHourLabel());
      playAlertSound();
      ringRef.current = setInterval(() => playAlertSound(), 30000);
    }
    function scheduleNext() {
      const now = new Date();
      const ms = (60 - now.getMinutes()) * 60000 - now.getSeconds() * 1000;
      scheduleRef.current = setTimeout(() => {
        startAlert();
        scheduleNext();
      }, ms);
    }
    scheduleNext();
    return () => {
      if (scheduleRef.current) clearTimeout(scheduleRef.current);
      if (ringRef.current) clearInterval(ringRef.current);
      if (countRef.current) clearTimeout(countRef.current);
    };
  }, []);

  // ── BACKGROUND SYNC ENGINE ──────────────────────────────────────────────
  // Retries queued uploads whenever the device is online, on the 'online'
  // event, and on a JITTERED interval. The jitter is important: every device
  // ran this on a fixed 30s tick, so all pending retries fired in lockstep and
  // slammed the backend at the same instants — the same synchronization that
  // makes the top-of-hour rush overload Apps Script. Randomizing each device's
  // cadence (and its first run) spreads that load out.
  useEffect(() => {
    injectAnimations();
    let syncing = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    async function processQueue() {
      if (syncing || !navigator.onLine) return;
      const queue = await idbGetAll();
      if (queue.length === 0) {
        setQueueCount(0);
        return;
      }
      syncing = true;
      for (const item of queue) {
        try {
          const ok = await uploadSubmission(item.record, item.files);
          if (ok) await idbDelete(item.id); // confirmed — remove from queue
        } catch {
          /* keep for next retry */
        }
      }
      setQueueCount(await idbCount());
      syncing = false;
    }
    // Reschedule with a random gap in [25s, 45s] so devices don't align.
    function scheduleNextSync() {
      if (stopped) return;
      const gap = 25000 + Math.floor(Math.random() * 20000);
      timer = setTimeout(async () => {
        await processQueue();
        scheduleNextSync();
      }, gap);
    }
    // Stagger the very first run too (0–8s) instead of everyone at mount.
    timer = setTimeout(() => {
      processQueue().then(scheduleNextSync);
    }, Math.floor(Math.random() * 8000));
    window.addEventListener("online", processQueue);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", processQueue);
    };
  }, []);

  useEffect(() => {
    if (!alertVisible) return;
    if (countdown <= 0) {
      setAlertVisible(false);
      if (ringRef.current) clearInterval(ringRef.current);
      return;
    }
    countRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => {
      if (countRef.current) clearTimeout(countRef.current);
    };
  }, [alertVisible, countdown]);

  function dismissAlert() {
    setAlertVisible(false);
    if (ringRef.current) clearInterval(ringRef.current);
    if (countRef.current) clearTimeout(countRef.current);
  }
  function handleFileAdd(sid: SectionId, files: FileList | null) {
    if (!files) return;
    const sec = SECTIONS.find((s) => s.id === sid)!;
    // Reject oversized videos up front. Large clips were split into dozens of
    // base64 chunks and reassembled in memory server-side, which routinely blew
    // Apps Script's 6-minute / memory limits and left the upload retrying
    // forever. A 25 MB cap keeps a short audit clip well within safe limits.
    const MAX_VIDEO_MB = 25;
    const incoming = Array.from(files).filter((f) => {
      const isVideo = f.type.startsWith("video");
      if (isVideo && f.size > MAX_VIDEO_MB * 1024 * 1024) {
        alert(
          `That video is ${(f.size / (1024 * 1024)).toFixed(
            0
          )} MB. Please keep clips under ${MAX_VIDEO_MB} MB (record a shorter clip) so it uploads reliably.`
        );
        return false;
      }
      return true;
    });
    if (incoming.length === 0) return;
    setSections((prev) => {
      const cur = prev[sid],
        rem = sec.max - cur.length;
      if (rem <= 0) return prev;
      const nf = incoming
        .slice(0, rem)
        .map((f) => ({
          id: Math.random().toString(36).slice(2),
          name: f.name,
          file: f,
          type: (f.type.startsWith("video") ? "video" : "image") as
            | "image"
            | "video",
          preview: URL.createObjectURL(f),
        }));
      return { ...prev, [sid]: [...cur, ...nf] };
    });
  }
  function removeFile(sid: SectionId, id: string) {
    setSections((prev) => ({
      ...prev,
      [sid]: prev[sid].filter((f) => f.id !== id),
    }));
  }
  async function toBase64(file: Blob): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onloadend = () => res((r.result as string).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  // ── IMAGE COMPRESSION ─────────────────────────────────────────────────
  // Resize to max 1600px on longest edge, JPEG ~85% quality (~350KB).
  // Shrinks 3MB phone photos by ~90% → uploads 10-20x faster, no timeouts.
  // Videos are NOT compressed (passed through untouched).
  async function compressImage(
    file: File,
    maxEdge = 1600,
    quality = 0.85
  ): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        // Scale down only if larger than maxEdge on the longest side
        if (width > maxEdge || height > maxEdge) {
          if (width >= height) {
            height = Math.round((height * maxEdge) / width);
            width = maxEdge;
          } else {
            width = Math.round((width * maxEdge) / height);
            height = maxEdge;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      }; // fallback to original
      img.src = url;
    });
  }

  async function handleSubmit(isRetry = false) {
    if (!store) {
      alert("Please select a store.");
      return;
    }
    // Shift window is evaluated in the selected country's local time.
    const liveHour = nowInCountry(country).getHours();
    if (liveHour < SHIFT_START || liveHour >= SHIFT_END) {
      alert(
        "Uploads are only allowed during shift hours (8 AM–10 PM, local time). This slot has elapsed."
      );
      return;
    }
    const allFiles = Object.values(sections).flat();
    if (allFiles.length === 0) {
      alert("Please upload at least one photo or video.");
      return;
    }
    // Always stamp with the live current hour (country-local) — never a stale slot
    const currentSlot = getCurrentHourLabel(country);
    const todayStr = fmtDate(nowInCountry(country).toISOString());
    // Warn (but allow) if this store+slot was already submitted today. Skipped
    // on retry, since a retry of a failed upload is not a real duplicate.
    if (!isRetry) {
      const already = loadSubmissions().some(
        (s) =>
          s.store === store &&
          normCountry((s as any).country) === normCountry(country) &&
          s.date === todayStr &&
          s.hourSlot === currentSlot
      );
      if (already) {
        const proceed = window.confirm(
          `${store} already has a submission for ${currentSlot} today.\n\nAdd these photos anyway?`
        );
        if (!proceed) return;
      }
    }
    setHourSlot(currentSlot);
    setSubmitting(true);

    const filesWithBase64 = await Promise.all(
      allFiles.map(async (f) => {
        const sid =
          (Object.entries(sections) as [SectionId, FileItem[]][]).find(
            ([, arr]) => arr.some((x) => x.id === f.id)
          )?.[0] || "inside";
        // Compress images before upload; videos pass through untouched.
        // 1280px @ 0.72 quality ≈ 150KB/photo — clear for audits, ~95% smaller
        // than raw, which is what keeps the total payload under timeout limits.
        const blob =
          f.type === "image" ? await compressImage(f.file, 1280, 0.72) : f.file;
        const mimeType =
          f.type === "image" ? "image/jpeg" : f.file.type || "video/mp4";
        const name =
          f.type === "image"
            ? f.name.replace(/\.(png|heic|heif|webp|jpeg|jpg)$/i, "") + ".jpg"
            : f.name;
        return { name, mimeType, base64: await toBase64(blob), section: sid };
      })
    );

    const record: Submission = {
      id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
      timestamp: new Date().toISOString(),
      date: fmtDate(nowInCountry(country).toISOString()),
      hourSlot: currentSlot,
      country,
      store,
      tl: mapping!.tl,
      supervisor: mapping!.supervisor,
      am: mapping!.am,
      cityManager: mapping!.cityManager,
      sections: {
        inside: sections.inside.map((f) => ({
          name: f.name,
          type: f.type,
          preview: f.preview,
        })),
        outside: sections.outside.map((f) => ({
          name: f.name,
          type: f.type,
          preview: f.preview,
        })),
        parking: sections.parking.map((f) => ({
          name: f.name,
          type: f.type,
          preview: f.preview,
        })),
      },
      totalFiles: allFiles.length,
    };
    saveSubmissions([record, ...loadSubmissions()]);

    // ── OFFLINE CHECK ────────────────────────────────────────────────────
    // If device is offline, queue immediately and tell the user it'll sync
    if (!navigator.onLine) {
      await idbAdd({
        id: record.id,
        record,
        files: filesWithBase64,
        queuedAt: new Date().toISOString(),
      });
      setQueueCount(await idbCount());
      setUploadStatus("queued");
      setSubmitting(false);
      setSubmitted(true);
      setSections({ inside: [], outside: [], parking: [] });
      setTimeout(() => {
        setSubmitted(false);
        setUploadStatus("idle");
      }, 7000);
      return;
    }

    let uploadOk = false;
    try {
      // Chunked upload — each file sent separately, confirmed, then Sheet row
      // written. No giant payload, so no timeouts. Fully idempotent.
      uploadOk = await uploadSubmission(record, filesWithBase64);
    } catch (e) {
      console.warn("Submit failed:", e);
    }

    // Step 3: If failed — queue to IndexedDB for retry AND log the failure
    if (!uploadOk) {
      // Persist full payload to IndexedDB so it auto-retries in the background
      // (and survives app close). Handles large payloads localStorage couldn't.
      try {
        await idbAdd({
          id: record.id,
          record,
          files: filesWithBase64,
          queuedAt: new Date().toISOString(),
        });
        setQueueCount(await idbCount());
      } catch (e) {
        console.warn("Queue save failed:", e);
      }
      try {
        const failRecord = {
          action: "logFailed",
          id: record.id,
          timestamp: record.timestamp,
          date: record.date,
          hourSlot: record.hourSlot,
          store: record.store,
          tl: record.tl,
          supervisor: record.supervisor,
          am: record.am,
          cityManager: record.cityManager,
          totalFiles: record.totalFiles,
          reason: "Record not found after 3 attempts — queued for auto-retry",
          deviceInfo: navigator.userAgent,
        };
        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(failRecord),
        });
      } catch (e) {
        console.warn("Failed to log failure:", e);
      }
    }

    setUploadStatus(uploadOk ? "success" : "failed");
    setSubmitting(false);
    setSubmitted(true);
    // CRITICAL: only clear photos on SUCCESS. On failure, keep them on screen so
    // the user can tap Retry without re-capturing anything.
    if (uploadOk) setSections({ inside: [], outside: [], parking: [] });
    setTimeout(
      () => {
        setSubmitted(false);
        setUploadStatus("idle");
      },
      uploadOk ? 7000 : 12000
    );
  }

  // Retry the current on-screen submission without re-capturing photos
  async function handleRetry() {
    setUploadStatus("idle");
    await handleSubmit(true);
  }

  const mins = String(Math.floor(countdown / 60)).padStart(2, "0");
  const secs = String(countdown % 60).padStart(2, "0");

  return (
    <div
      style={{
        background: "#1C1C1E",
        minHeight: "100vh",
        fontFamily: "system-ui,-apple-system,sans-serif",
        maxWidth: 520,
        margin: "0 auto",
        paddingBottom: 72,
      }}
    >
      <div
        style={{
          background: "#242426",
          padding: "14px 20px",
          borderBottom: "1px solid #2E2E30",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <NoonLogo />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#F5D000" }}>
            Hourly Update
          </div>
          <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
            {new Date().toLocaleDateString("en-AE", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}{" "}
            · {getCurrentHourLabel()}
          </div>
        </div>
      </div>

      {alertVisible && (
        <div
          style={{
            margin: "12px 16px",
            background: "#C0181D",
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid #E31E24",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <div style={{ flex: 1 }}>
            <p
              style={{
                margin: 0,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Hourly update required!
            </p>
            <p
              style={{
                margin: "2px 0 0",
                color: "rgba(255,255,255,0.85)",
                fontSize: 11,
              }}
            >
              Upload store photos now
            </p>
          </div>
          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              borderRadius: 20,
              padding: "4px 10px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              minWidth: 52,
              textAlign: "center" as const,
            }}
          >
            {mins}:{secs}
          </div>
          <button
            onClick={dismissAlert}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              fontSize: 18,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {submitted && (
        <div
          className="ds-slide"
          style={{
            margin: "12px 16px",
            background:
              uploadStatus === "failed"
                ? "#3A1A1A"
                : uploadStatus === "queued"
                ? "#2A2A1A"
                : "#1E3A1E",
            borderRadius: 10,
            padding: "12px 14px",
            border: `1px solid ${
              uploadStatus === "failed"
                ? "#E31E24"
                : uploadStatus === "queued"
                ? "#B8860B"
                : "#2A4A2A"
            }`,
          }}
        >
          {uploadStatus === "success" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <p
                  style={{
                    margin: 0,
                    color: "#4ADE80",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  Upload confirmed for {hourSlot}!
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    color: "#4ADE80",
                    fontSize: 11,
                    opacity: 0.8,
                  }}
                >
                  Photos saved to Drive · logged to Sheet
                </p>
              </div>
            </div>
          )}
          {uploadStatus === "failed" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>❌</span>
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    color: "#FF6B6B",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  Upload Failed
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    color: "#FF6B6B",
                    fontSize: 11,
                    opacity: 0.8,
                  }}
                >
                  Your photos are saved — tap Retry, no need to recapture
                </p>
              </div>
              <button
                onClick={handleRetry}
                disabled={submitting}
                style={{
                  background: submitting ? "#3A3A3C" : "#F5D000",
                  color: submitting ? "#666" : "#1C1C1E",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                ↻ Retry
              </button>
            </div>
          )}
          {uploadStatus === "queued" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>📡</span>
              <div>
                <p
                  style={{
                    margin: 0,
                    color: "#F5D000",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  No connection — saved offline
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    color: "#F5D000",
                    fontSize: 11,
                    opacity: 0.8,
                  }}
                >
                  Will upload automatically when back online
                </p>
              </div>
            </div>
          )}
          {uploadStatus === "idle" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }} className="ds-pulse">
                ⏳
              </span>
              <div>
                <p
                  style={{
                    margin: 0,
                    color: "#F5D000",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  Submitted · verifying upload…
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    color: "#F5D000",
                    fontSize: 11,
                    opacity: 0.8,
                  }}
                >
                  Checking if photos reached the server
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {queueCount > 0 && !submitted && (
        <div
          className="ds-fade"
          style={{
            margin: "12px 16px 0",
            background: "#2A2A1A",
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid #5A4A1A",
          }}
        >
          <span className="ds-pulse" style={{ fontSize: 16 }}>
            📡
          </span>
          <p
            style={{
              margin: 0,
              color: "#F5D000",
              fontSize: 12,
              fontWeight: 600,
              flex: 1,
            }}
          >
            {queueCount} upload{queueCount > 1 ? "s" : ""} pending — syncing in
            background
          </p>
        </div>
      )}

      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            background: "#242426",
            border: "0.5px solid #333335",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 10,
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#777",
              textTransform: "uppercase" as const,
              letterSpacing: "0.1em",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Country
          </div>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{
              width: "100%",
              background: "#2C2C2E",
              border: "0.5px solid #3A3A3C",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              fontWeight: 600,
              color: "#F5D000",
              appearance: "none" as const,
              fontFamily: "inherit",
              marginBottom: 12,
            }}
          >
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div
            style={{
              fontSize: 10,
              color: "#777",
              textTransform: "uppercase" as const,
              letterSpacing: "0.1em",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Dark store location
          </div>
          <input
            type="text"
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            placeholder="🔍 Search store name…"
            style={{
              width: "100%",
              background: "#2C2C2E",
              border: "0.5px solid #3A3A3C",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              color: "#F5D000",
              fontFamily: "inherit",
              marginBottom: 8,
              boxSizing: "border-box" as const,
            }}
          />
          <select
            value={store}
            onChange={(e) => {
              setStore(e.target.value);
              setStoreSearch("");
            }}
            size={storeSearch ? 6 : 1}
            style={{
              width: "100%",
              background: "#2C2C2E",
              border: "0.5px solid #3A3A3C",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              fontWeight: 500,
              color: "#F5D000",
              appearance: "none" as const,
              fontFamily: "inherit",
            }}
          >
            <option value="">— Select your store —</option>
            {storesForCountry.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {storeSearch && storesForCountry.length === 0 && (
            <div style={{ fontSize: 11, color: "#FF6B6B", marginTop: 6 }}>
              No stores match "{storeSearch}" in {country}
            </div>
          )}
          {mapping && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                marginTop: 10,
              }}
            >
              {[
                { l: "Team Leader", v: mapping.tl },
                { l: "Supervisor", v: mapping.supervisor },
                { l: "Asst. Manager", v: mapping.am },
                { l: "City Manager", v: mapping.cityManager },
              ].map(({ l, v }) => (
                <div
                  key={l}
                  style={{
                    background: "#2C2C2E",
                    border: "0.5px solid #3A3A3C",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: "#666",
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                    }}
                  >
                    {l}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#F5D000",
                      fontWeight: 600,
                      marginTop: 3,
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: "#242426",
            border: "0.5px solid #333335",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#777",
              textTransform: "uppercase" as const,
              letterSpacing: "0.1em",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Current hour slot
          </div>
          {withinShift ? (
            <div
              style={{
                width: "100%",
                background: "#F5D000",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 15,
                fontWeight: 800,
                color: "#1C1C1E",
                textAlign: "center" as const,
                fontFamily: "inherit",
              }}
            >
              {hourSlot}
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                background: "#2C2C2E",
                border: "0.5px solid #3A3A3C",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 600,
                color: "#888",
                textAlign: "center" as const,
              }}
            >
              Outside shift hours (8 AM–10 PM)
            </div>
          )}
          <div
            style={{
              fontSize: 10,
              color: "#666",
              marginTop: 6,
              textAlign: "center" as const,
            }}
          >
            Uploads are locked to the current hour — elapsed slots can't be
            submitted
          </div>
        </div>

        <div
          style={{
            height: 1,
            background:
              "linear-gradient(90deg,transparent,#F5D000,transparent)",
            margin: "2px 0 10px",
            opacity: 0.2,
          }}
        />

        {SECTIONS.map((sec) => {
          const files = sections[sec.id];
          const remaining = sec.max - files.length;
          const full = remaining === 0;
          return (
            <div
              key={sec.id}
              style={{
                background: "#242426",
                border: "0.5px solid #333335",
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: "#2C2C2E",
                      border: "0.5px solid #3A3A3C",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <SectionIcon type={sec.icon} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#F0F0F0",
                      }}
                    >
                      {sec.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>
                      {sec.sub}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: full
                      ? "#E31E24"
                      : files.length > 0
                      ? "#1E3A1E"
                      : "#2C2C2E",
                    color: full
                      ? "#fff"
                      : files.length > 0
                      ? "#4ADE80"
                      : "#F5D000",
                    border: full
                      ? "none"
                      : files.length > 0
                      ? "0.5px solid #2A4A2A"
                      : "0.5px solid #3A3A3C",
                  }}
                >
                  {files.length}/{sec.max}
                  {full ? " ✓" : ""}
                </div>
              </div>
              {files.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 8,
                    flexWrap: "wrap" as const,
                  }}
                >
                  {files.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        background: "#2C2C2E",
                        border: "1.5px solid #F5D000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative" as const,
                        overflow: "hidden",
                      }}
                    >
                      {f.type === "image" ? (
                        <img
                          src={f.preview}
                          alt={f.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 22 }}>🎬</span>
                      )}
                      {/* Remove (✕) is HIDDEN while an upload is in progress so photos
                          can't be deleted mid-submit. It reappears if upload fails. */}
                      {!submitting && (
                        <button
                          onClick={() => removeFile(sec.id, f.id)}
                          style={{
                            position: "absolute" as const,
                            top: -5,
                            right: -5,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#E31E24",
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {remaining > 0 && !submitting && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexDirection: "column" as const,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#2C2C2E",
                      border: "1px solid #3A3A3C",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "#F5D000",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📷</span>Take Photo ·{" "}
                    {remaining} remaining
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileAdd(sec.id, e.target.files)}
                    />
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#2C2C2E",
                      border: "1px solid #3A3A3C",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "#888",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🎬</span>Record Video ·{" "}
                    {remaining} remaining
                    <input
                      type="file"
                      accept="video/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileAdd(sec.id, e.target.files)}
                    />
                  </label>
                </div>
              )}
              {submitting && files.length > 0 && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#777",
                    fontStyle: "italic" as const,
                    padding: "4px 2px",
                  }}
                >
                  🔒 Photos locked during upload
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={() => handleSubmit(false)}
          disabled={submitting || !store || !withinShift}
          style={{
            width: "100%",
            background:
              !store || submitting || !withinShift ? "#3A3A3C" : "#F5D000",
            color: !store || submitting || !withinShift ? "#666" : "#1C1C1E",
            fontSize: 16,
            fontWeight: 800,
            border: "none",
            borderRadius: 12,
            padding: 16,
            cursor:
              !store || submitting || !withinShift ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {!withinShift
            ? "Uploads closed (8 AM–10 PM)"
            : submitting
            ? "Submitting…"
            : "Submit Hourly Update →"}
        </button>
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#444",
            marginTop: 10,
            letterSpacing: "0.04em",
          }}
        >
          noon minutes · dark store operations · UAE
        </p>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "#2C2C2E",
        border: `0.5px solid ${value ? "#F5D000" : "#3A3A3C"}`,
        borderRadius: 8,
        padding: "7px 10px",
        fontSize: 11,
        color: value ? "#F5D000" : "#888",
        fontFamily: "inherit",
        appearance: "none" as const,
        cursor: "pointer",
        flex: 1,
        minWidth: 0,
      }}
    >
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ── DASHBOARD VIEW ────────────────────────────────────────────────────────
function DashboardView({
  user,
  onLogout,
}: {
  user: UserAccount;
  onLogout: () => void;
}) {
  // Scope the visible stores based on the logged-in user's role
  const SCOPED_STORES = getScopedStores(user);
  // Hard country gate on rows: even if a store name collides across countries,
  // a user never sees a country they aren't entitled to. Legacy rows with no
  // Country value read as the default (UAE).
  const allowedCountrySet = new Set(userCountries(user).map(norm));
  const rowInScopeCountry = (r: any) =>
    allowedCountrySet.has(norm(normCountry(r.Country)));
  const canExport = true; // Admin, L1 (CM/Supervisor), L2 (TL) — all can export
  const [sheetData, setSheetData] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");
  const [days, setDays] = useState(7);
  const [dbTab, setDbTab] = useState<
    | "overview"
    | "supervisor"
    | "am"
    | "stores"
    | "flagged"
    | "heatmap"
    | "gallery"
  >("overview");
  const [drillStore, setDrillStore] = useState<string | null>(null);
  // Filter states for various tabs
  const [supFilter, setSupFilter] = useState("");
  const [amFilter, setAmFilter] = useState("");
  const [storeSearchDb, setStoreSearchDb] = useState("");
  const [flagSup, setFlagSup] = useState("");
  const [flagTL, setFlagTL] = useState("");
  const [flagAM, setFlagAM] = useState("");
  const [flagCM, setFlagCM] = useState("");
  const [galleryStore, setGalleryStore] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef<{ startY: number; pulling: boolean }>({
    startY: 0,
    pulling: false,
  });
  const [pullDist, setPullDist] = useState(0);

  useEffect(() => {
    injectAnimations();
    fetchSheet();
    const iv = setInterval(() => fetchSheet(true), 60000);
    return () => clearInterval(iv);
  }, []);

  // ── PULL TO REFRESH ─────────────────────────────────────────────────────
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY <= 0) {
        pullRef.current.startY = e.touches[0].clientY;
        pullRef.current.pulling = true;
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (!pullRef.current.pulling) return;
      const dist = e.touches[0].clientY - pullRef.current.startY;
      if (dist > 0 && window.scrollY <= 0) {
        setPullDist(Math.min(dist * 0.5, 80));
      }
    }
    function onTouchEnd() {
      if (pullDist > 60) {
        setRefreshing(true);
        fetchSheet().finally(() => setTimeout(() => setRefreshing(false), 600));
      }
      setPullDist(0);
      pullRef.current.pulling = false;
    }
    window.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDist]);

  // Fetch ONE country's Current tab (each country can live in its own
  // spreadsheet). Returns the rows array, or "busy" (quota HTML) / "error".
  async function fetchOneCountry(
    ctry: string
  ): Promise<any[] | "busy" | "error"> {
    const delays = [0, 4000, 8000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt])
        await new Promise((r) => setTimeout(r, delays[attempt]));
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25000);
        const res = await fetch(
          `${GOOGLE_SCRIPT_URL}?country=${encodeURIComponent(ctry)}`,
          { signal: ctrl.signal }
        );
        clearTimeout(timer);
        const text = await res.text();
        if (/too many scripts|<html|<!DOCTYPE/i.test(text)) {
          if (attempt < delays.length - 1) continue;
          return "busy";
        }
        try {
          const raw = JSON.parse(text);
          return Array.isArray(raw) ? raw : [];
        } catch {
          if (attempt < delays.length - 1) continue;
          return "error";
        }
      } catch {
        if (attempt < delays.length - 1) continue;
        return "error";
      }
    }
    return "error";
  }

  async function fetchSheet(isAutoRefresh = false) {
    // Fan out across only the countries this user is scoped to, then merge.
    // A single-country user makes one call (as before); a multi-country user
    // reads each country's sheet in parallel.
    const scopedCountries = Array.from(
      new Set(getScopedStores(user).map(storeCountry))
    );
    const countriesToFetch = scopedCountries.length
      ? scopedCountries
      : userCountries(user);

    const results = await Promise.all(countriesToFetch.map(fetchOneCountry));
    const merged: any[] = [];
    let anyOk = false;
    let anyBusy = false;
    results.forEach((r) => {
      if (Array.isArray(r)) {
        anyOk = true;
        for (const row of r) merged.push(row);
      } else if (r === "busy") anyBusy = true;
    });

    if (!anyOk) {
      // Nothing came back — keep whatever's on screen, flag why.
      setError(
        anyBusy
          ? "Server busy (Google quota). Showing last data — retrying shortly."
          : isAutoRefresh
          ? "Couldn't refresh (server busy). Showing last data."
          : "Server busy or unreachable. Pull down to retry."
      );
      setLoading(false);
      return;
    }

    const clean = merged.filter(
      (r: any) => r.Store && r.Store !== "TEST" && r.Store !== ""
    );
    setSheetData(clean);
    setLastRefresh(
      new Date().toLocaleTimeString("en-AE", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
    // Partial success (some countries busy) — show data but note it.
    setError(anyBusy ? "Some countries still loading (server busy)…" : "");
    setLoading(false);
  }

  // ── CSV / EXCEL EXPORT ──────────────────────────────────────────────────
  // Exports the currently filtered store data (respects day range)
  function exportCSV() {
    const headers = [
      "Store",
      "TL",
      "Supervisor",
      "AM",
      "Submitted",
      "Expected",
      "Adherence %",
      "Status",
    ];
    const rows = storeData.map((r) => [
      r.store,
      r.tl,
      r.sup,
      r.am,
      r.submitted,
      r.expected,
      r.pct,
      r.pct >= THRESHOLD ? "Good" : r.pct >= 60 ? "Watch" : "Flag",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    downloadBlob(
      blob,
      `noon-adherence-${days}day-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }
  function exportExcel() {
    // Build an HTML table that Excel opens natively as a styled .xls
    const headerStyle =
      "background:#F5D000;color:#1C1C1E;font-weight:bold;padding:6px;border:1px solid #ccc;";
    const cell = "padding:5px;border:1px solid #ddd;";
    const rowsHtml = storeData
      .map((r) => {
        const col =
          r.pct >= THRESHOLD ? "#1E7A1E" : r.pct >= 60 ? "#A06000" : "#C01818";
        const status =
          r.pct >= THRESHOLD ? "Good" : r.pct >= 60 ? "Watch" : "Flag";
        return `<tr><td style="${cell}">${r.store}</td><td style="${cell}">${r.tl}</td><td style="${cell}">${r.sup}</td><td style="${cell}">${r.am}</td><td style="${cell}text-align:center;">${r.submitted}</td><td style="${cell}text-align:center;">${r.expected}</td><td style="${cell}text-align:center;color:${col};font-weight:bold;">${r.pct}%</td><td style="${cell}color:${col};">${status}</td></tr>`;
      })
      .join("");
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table style="border-collapse:collapse;font-family:Arial;font-size:12px;"><tr><td colspan="8" style="font-size:16px;font-weight:bold;padding:10px;">noon Minutes — Adherence Report (${days}-day) — ${new Date().toLocaleDateString(
      "en-AE"
    )}</td></tr><tr><th style="${headerStyle}">Store</th><th style="${headerStyle}">TL</th><th style="${headerStyle}">Supervisor</th><th style="${headerStyle}">AM</th><th style="${headerStyle}">Submitted</th><th style="${headerStyle}">Expected</th><th style="${headerStyle}">Adherence</th><th style="${headerStyle}">Status</th></tr>${rowsHtml}</table></body></html>`;
    const blob = new Blob(["\uFEFF" + html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    downloadBlob(
      blob,
      `noon-adherence-${days}day-${new Date().toISOString().slice(0, 10)}.xls`
    );
  }
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const dates = getLast7Dates(days);
  const dateSet = new Set(dates);
  // CRITICAL FIX: scope to the user's stores. Previously `filtered` included
  // ALL stores' rows, so submitted counted every store while expected was based
  // only on the user's store count — inflating submitted and shrinking expected.
  const scopedSet = new Set(SCOPED_STORES.map(norm));
  const filtered = sheetData.filter(
    (r) =>
      dateSet.has(extractDate(r.Date)) &&
      scopedSet.has(norm(r.Store)) &&
      rowInScopeCountry(r)
  );

  function calcAdh(rows: SheetRow[], stores: string[]) {
    // Count UNIQUE (store, date, hour-slot) combinations — two submissions for
    // the same store+slot count as ONE, so duplicates never inflate adherence.
    const uniq = new Set<string>();
    rows.forEach((r) =>
      uniq.add(
        r.Store + "|" + extractDate(r.Date) + "|" + extractHourSlot(r.HourSlot)
      )
    );
    const submitted = uniq.size;
    const expected = expectedSlots(dates, stores);
    // Nothing due yet (e.g. before 8 AM) = compliant, not flagged
    const pct =
      expected === 0
        ? 100
        : Math.min(100, Math.round((submitted / expected) * 100));
    return { submitted, expected, pct };
  }

  const allAdh = calcAdh(filtered, SCOPED_STORES);

  const trendData = dates.map((date) => {
    const dayRows = filtered.filter(
      (r) => extractDate(r.Date) === date && SCOPED_STORES.includes(r.Store)
    );
    const uniqDay = new Set<string>();
    dayRows.forEach((r) =>
      uniqDay.add(r.Store + "|" + extractHourSlot(r.HourSlot))
    );
    const expectedToday = expectedSlots([date], SCOPED_STORES);
    const pct =
      expectedToday === 0
        ? 100
        : Math.min(100, Math.round((uniqDay.size / expectedToday) * 100));
    return { date, pct, label: getDayLabel(date) };
  });

  const supNames = Array.from(
    new Set(SCOPED_STORES.map((s) => STORE_MAPPING[s].supervisor))
  );
  const supData = supNames
    .map((sup) => {
      const supStores = SCOPED_STORES.filter(
        (s) => STORE_MAPPING[s].supervisor === sup
      );
      const rows = filtered.filter((r) => supStores.includes(r.Store));
      const { submitted, expected, pct } = calcAdh(rows, supStores);
      const am = STORE_MAPPING[supStores[0]]?.am || "-";
      const cm = STORE_MAPPING[supStores[0]]?.cityManager || "-";
      return {
        sup,
        am,
        cm,
        stores: supStores.length,
        submitted,
        expected,
        pct,
      };
    })
    .sort((a, b) => a.pct - b.pct);

  const amNames = Array.from(
    new Set(SCOPED_STORES.map((s) => STORE_MAPPING[s].am))
  );
  const amData = amNames
    .map((am) => {
      const amStores = SCOPED_STORES.filter((s) => STORE_MAPPING[s].am === am);
      const rows = filtered.filter((r) => amStores.includes(r.Store));
      const { submitted, expected, pct } = calcAdh(rows, amStores);
      const cm = STORE_MAPPING[amStores[0]]?.cityManager || "-";
      return { am, cm, stores: amStores.length, submitted, expected, pct };
    })
    .sort((a, b) => a.pct - b.pct);

  const storeData = SCOPED_STORES.map((store) => {
    const m = STORE_MAPPING[store];
    const rows = filtered.filter((r) => norm(r.Store) === norm(store));
    const { submitted, expected, pct } = calcAdh(rows, [store]);
    return {
      store,
      tl: m.tl,
      sup: m.supervisor,
      am: m.am,
      cm: m.cityManager,
      submitted,
      expected,
      pct,
    };
  }).sort((a, b) => a.pct - b.pct);

  // Single source of truth — Overview count and Flagged tab use the SAME list
  const goodStores = storeData.filter((r) => r.pct >= THRESHOLD);
  const flaggedStores = storeData.filter((r) => r.pct < THRESHOLD);

  // ── UNIQUE LISTS for filter dropdowns (scoped to user) ──────────────────
  const allTLs = Array.from(
    new Set(SCOPED_STORES.map((s) => STORE_MAPPING[s].tl))
  )
    .filter((x) => x && x !== "NTH")
    .sort();
  const allSups = Array.from(
    new Set(SCOPED_STORES.map((s) => STORE_MAPPING[s].supervisor))
  )
    .filter(Boolean)
    .sort();
  const allAMs = Array.from(
    new Set(SCOPED_STORES.map((s) => STORE_MAPPING[s].am))
  )
    .filter((x) => x && x !== "NTH")
    .sort();
  const allCMs = Array.from(
    new Set(SCOPED_STORES.map((s) => STORE_MAPPING[s].cityManager))
  )
    .filter(Boolean)
    .sort();

  // ── FILTERED views ──────────────────────────────────────────────────────
  const supDataFiltered = supFilter
    ? supData.filter((r) => r.sup === supFilter)
    : supData;
  const amDataFiltered = amFilter
    ? amData.filter((r) => r.am === amFilter)
    : amData;
  const storeDataFiltered = storeData.filter((r) => {
    if (
      storeSearchDb &&
      !r.store.toLowerCase().includes(storeSearchDb.toLowerCase())
    )
      return false;
    return true;
  });
  const flaggedFiltered = storeData.filter((r) => {
    if (r.pct >= THRESHOLD) return false;
    if (flagSup && r.sup !== flagSup) return false;
    if (flagTL && r.tl !== flagTL) return false;
    if (flagAM && r.am !== flagAM) return false;
    if (flagCM && r.cm !== flagCM) return false;
    return true;
  });

  // ── HEATMAP: today's hourly status per store ────────────────────────────
  // Shows TODAY's real-time compliance. A slot is only "missed" if its hour has
  // already passed; slots later than the current hour are "upcoming", not missed.
  const heatmapSlots = [
    "8:00 AM",
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
    "6:00 PM",
    "7:00 PM",
    "8:00 PM",
    "9:00 PM",
    "10:00 PM",
  ];
  const heatmapShort = [
    "8",
    "9",
    "10",
    "11",
    "12",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8p",
    "9p",
    "10p",
  ];
  const heatmapToday = fmtDate(new Date().toISOString());
  const heatmapNowHour = new Date().getHours();
  function heatmapForStore(
    store: string
  ): ("submitted" | "missed" | "upcoming")[] {
    const rows = sheetData.filter(
      (r) =>
        norm(r.Store) === norm(store) && extractDate(r.Date) === heatmapToday
    );
    // Match by HOUR NUMBER, not string — eliminates any label/spacing/format
    // mismatch (the reason some submitted hours weren't showing as green).
    const submittedHours = new Set<number>();
    rows.forEach((r) => {
      const h = slotLabelToHour(extractHourSlot(r.HourSlot));
      if (h >= 0) submittedHours.add(h);
    });
    return heatmapSlots.map((_, i) => {
      const slotHour = SHIFT_START + i; // index 0 = 8 AM (8) … index 14 = 10 PM (22)
      if (submittedHours.has(slotHour)) return "submitted";
      if (slotHour < heatmapNowHour) return "missed"; // elapsed & not submitted
      return "upcoming";
    });
  }
  const heatmapStores = storeSearchDb
    ? SCOPED_STORES.filter((s) =>
        s.toLowerCase().includes(storeSearchDb.toLowerCase())
      )
    : SCOPED_STORES;

  // ── GALLERY data: submissions with photo links for selected store ───────
  function parseFileLinks(row: SheetRow): string[] {
    const raw = row.FileLinks || "";
    if (!raw) return [];
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Convert Drive view link to direct thumbnail URL
  function driveThumb(url: string): string {
    const m =
      url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400` : url;
  }
  const galleryRowsRaw = galleryStore
    ? filtered
        .filter((r) => norm(r.Store) === norm(galleryStore))
        .sort(
          (a, b) =>
            new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()
        )
    : [];
  // Collapse duplicate submissions for the same date+slot — keep the latest
  // (rows are already sorted newest-first, so the first one seen wins).
  const gallerySeen = new Set<string>();
  const galleryRows = galleryRowsRaw.filter((r) => {
    const key = extractDate(r.Date) + "|" + extractHourSlot(r.HourSlot);
    if (gallerySeen.has(key)) return false;
    gallerySeen.add(key);
    return true;
  });

  const drillData = drillStore
    ? filtered.filter((r) => norm(r.Store) === norm(drillStore))
    : [];
  const drillAdh = drillStore
    ? calcAdh(drillData, [drillStore])
    : { pct: 0, submitted: 0, expected: 0 };
  const drillDays = dates.map((date) => {
    const r = drillData.filter((x) => extractDate(x.Date) === date);
    const uniq = new Set<string>();
    r.forEach((x) => uniq.add(extractHourSlot(x.HourSlot)));
    const elapsed = getElapsedSlots(date, storeCountry(drillStore));
    const pct =
      elapsed === 0
        ? 100
        : Math.min(100, Math.round((uniq.size / elapsed) * 100));
    return { date, pct, label: getDayLabel(date) };
  });

  const TBLTH: React.CSSProperties = {
    padding: "7px 10px",
    textAlign: "left",
    fontWeight: 600,
    color: "#555",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "1px solid #2E2E30",
    whiteSpace: "nowrap",
  };
  const TBLTD: React.CSSProperties = {
    padding: "8px 10px",
    borderBottom: "0.5px solid #2A2A2A",
    color: "#CCC",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };
  const DBCARD: React.CSSProperties = {
    background: "#242426",
    border: "0.5px solid #333335",
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 12,
  };
  const dbTabs: (typeof dbTab)[] = [
    "overview",
    "supervisor",
    "am",
    "stores",
    "flagged",
    "heatmap",
    "gallery",
  ];
  const dbTabLabels = [
    "Overview",
    "Supervisor",
    "AM",
    "Stores",
    "Flagged ⚑",
    "Heatmap",
    "Photos",
  ];

  return (
    <div
      style={{
        background: "#1C1C1E",
        minHeight: "100vh",
        fontFamily: "system-ui,-apple-system,sans-serif",
        maxWidth: 520,
        margin: "0 auto",
        paddingBottom: 72,
      }}
    >
      {(pullDist > 0 || refreshing) && (
        <div
          style={{
            height: pullDist || 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1C1C1E",
            overflow: "hidden",
            transition: refreshing ? "none" : "height 0.2s ease",
          }}
        >
          <span
            className={refreshing ? "ds-spin" : ""}
            style={{ fontSize: 18, color: "#F5D000", display: "inline-block" }}
          >
            {refreshing ? "⟳" : pullDist > 60 ? "↓" : "↻"}
          </span>
          <span style={{ fontSize: 11, color: "#777", marginLeft: 8 }}>
            {refreshing
              ? "Refreshing…"
              : pullDist > 60
              ? "Release to refresh"
              : "Pull to refresh"}
          </span>
        </div>
      )}
      <div
        style={{
          background: "#242426",
          padding: "14px 20px",
          borderBottom: "1px solid #2E2E30",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <NoonLogo />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#F5D000" }}>
            Operations Dashboard
          </div>
          <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
            {lastRefresh ? `Updated ${lastRefresh}` : "Loading data…"}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#1F1F21",
          padding: "8px 20px",
          borderBottom: "1px solid #2E2E30",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background:
                user.role === "Admin"
                  ? "#E31E24"
                  : user.role === "L1"
                  ? "#F5D000"
                  : "#4ADE80",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: user.role === "L1" ? "#1C1C1E" : "#fff",
            }}
          >
            {user.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#F0F0F0" }}>
              {user.name}
            </div>
            <div style={{ fontSize: 10, color: "#777" }}>
              {user.scopeType === "all"
                ? "Admin · all stores"
                : user.scopeType === "cityManager"
                ? `City Manager · ${SCOPED_STORES.length} stores`
                : user.scopeType === "supervisor"
                ? `Supervisor · ${SCOPED_STORES.length} stores`
                : `Team Leader · ${SCOPED_STORES.length} stores`}
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: "#2C2C2E",
            border: "0.5px solid #3A3A3C",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 600,
            color: "#FF6B6B",
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span style={{ fontSize: 13 }}>⏻</span> Logout
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "10px 16px 0",
          borderBottom: "1px solid #2E2E30",
          overflowX: "auto" as const,
          background: "#242426",
        }}
      >
        {dbTabs.map((t, i) => (
          <button
            key={t}
            onClick={() => {
              setDbTab(t);
              setDrillStore(null);
            }}
            style={{
              padding: "7px 12px",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: "8px 8px 0 0",
              cursor: "pointer",
              color: dbTab === t ? "#1C1C1E" : "#666",
              background: dbTab === t ? "#F5D000" : "transparent",
              border: "none",
              fontFamily: "inherit",
              whiteSpace: "nowrap" as const,
            }}
          >
            {dbTabLabels[i]}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            paddingTop: 12,
            marginBottom: 8,
            alignItems: "center",
          }}
        >
          {[1, 7, 10].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: `0.5px solid ${days === d ? "#F5D000" : "#3A3A3C"}`,
                background: days === d ? "#F5D000" : "#2C2C2E",
                color: days === d ? "#1C1C1E" : "#888",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {d === 1 ? "Today" : `${d} days`}
            </button>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#555" }}>
            {sheetData.length} records
          </div>
        </div>

        {canExport && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              onClick={exportCSV}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "9px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: "0.5px solid #3A3A3C",
                background: "#2C2C2E",
                color: "#4ADE80",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 14 }}>📄</span> Export CSV
            </button>
            <button
              onClick={exportExcel}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "9px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: "0.5px solid #3A3A3C",
                background: "#2C2C2E",
                color: "#60A5FA",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 14 }}>📊</span> Export Excel
            </button>
          </div>
        )}

        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "#555",
              fontSize: 14,
            }}
          >
            <span
              className="ds-spin"
              style={{ display: "inline-block", marginRight: 8 }}
            >
              ⟳
            </span>
            Loading data…
          </div>
        )}
        {error && (
          <div
            style={{
              margin: "4px 0 12px",
              background: "#2A2A1A",
              border: "0.5px solid #5A4A1A",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ fontSize: 12, color: "#F5D000", flex: 1 }}>
              {error}
            </span>
          </div>
        )}

        {!loading && (sheetData.length > 0 || !error) && (
          <>
            {dbTab === "overview" && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  {[
                    {
                      l: "Overall adherence",
                      v: `${allAdh.pct}%`,
                      c: adColor(allAdh.pct),
                      s: `${allAdh.submitted} of ${allAdh.expected}`,
                    },
                    {
                      l: "Updates submitted",
                      v: allAdh.submitted.toLocaleString(),
                      c: "#60A5FA",
                      s: `of ${allAdh.expected.toLocaleString()} expected`,
                    },
                    {
                      l: `Stores ≥ ${THRESHOLD}%`,
                      v: goodStores.length,
                      c: "#4ADE80",
                      s: "compliant",
                    },
                    {
                      l: "Flagged stores",
                      v: flaggedStores.length,
                      c: "#FF6B6B",
                      s: `below ${THRESHOLD}%`,
                    },
                  ].map(({ l, v, c, s }) => (
                    <div
                      key={l}
                      style={{
                        background: "#242426",
                        border: "0.5px solid #2E2E30",
                        borderRadius: 12,
                        padding: "12px 14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "#666",
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.08em",
                          fontWeight: 600,
                          marginBottom: 6,
                        }}
                      >
                        {l}
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: c }}>
                        {v}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#555", marginTop: 3 }}
                      >
                        {s}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={DBCARD}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#F0F0F0",
                      marginBottom: 2,
                    }}
                  >
                    {days}-day adherence trend
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#555", marginBottom: 12 }}
                  >
                    All stores · hourly submissions %
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${dates.length},1fr)`,
                      gap: 6,
                      alignItems: "end",
                      height: 90,
                      marginBottom: 8,
                    }}
                  >
                    {trendData.map(({ date, pct, label }) => (
                      <div
                        key={date}
                        style={{
                          display: "flex",
                          flexDirection: "column" as const,
                          alignItems: "center",
                          gap: 3,
                          height: "100%",
                          justifyContent: "flex-end",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: adColor(pct),
                          }}
                        >
                          {pct}%
                        </div>
                        <div
                          style={{
                            width: "100%",
                            borderRadius: "4px 4px 0 0",
                            minHeight: 3,
                            background: adColor(pct),
                            height: `${Math.max(pct, 3)}%`,
                          }}
                        />
                        <div style={{ fontSize: 10, color: "#555" }}>
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      fontSize: 11,
                      color: "#555",
                      flexWrap: "wrap" as const,
                    }}
                  >
                    {[
                      { c: "#4ADE80", l: `≥${THRESHOLD}% good` },
                      { c: "#F5D000", l: "60–89% ok" },
                      { c: "#FF6B6B", l: "<60% flag" },
                    ].map(({ c, l }) => (
                      <span
                        key={l}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: c,
                            display: "inline-block",
                          }}
                        />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {dbTab === "supervisor" && (
              <div style={DBCARD}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#F0F0F0",
                    marginBottom: 8,
                  }}
                >
                  By supervisor — ranked lowest first
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <FilterSelect
                    label="Supervisor"
                    value={supFilter}
                    onChange={setSupFilter}
                    options={allSups}
                  />
                </div>
                <div style={{ overflowX: "auto" as const }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse" as const,
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={TBLTH}>Supervisor</th>
                        <th style={TBLTH}>AM</th>
                        <th style={TBLTH}>Stores</th>
                        <th style={TBLTH}>Adherence</th>
                        <th style={TBLTH}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supDataFiltered.map((r) => (
                        <tr key={r.sup}>
                          <td
                            style={{
                              ...TBLTD,
                              color: adColor(r.pct),
                              fontWeight: 500,
                            }}
                          >
                            {r.sup}
                          </td>
                          <td style={{ ...TBLTD, color: "#777" }}>{r.am}</td>
                          <td style={TBLTD}>{r.stores}</td>
                          <td style={TBLTD}>
                            <PBar pct={r.pct} />
                          </td>
                          <td style={TBLTD}>
                            <AdBadge pct={r.pct} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {dbTab === "am" && (
              <div style={DBCARD}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#F0F0F0",
                    marginBottom: 8,
                  }}
                >
                  By assistant manager — ranked lowest first
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <FilterSelect
                    label="Manager"
                    value={amFilter}
                    onChange={setAmFilter}
                    options={allAMs}
                  />
                </div>
                <div style={{ overflowX: "auto" as const }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse" as const,
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={TBLTH}>Asst. Manager</th>
                        <th style={TBLTH}>City Mgr</th>
                        <th style={TBLTH}>Stores</th>
                        <th style={TBLTH}>Adherence</th>
                        <th style={TBLTH}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {amDataFiltered.map((r) => (
                        <tr key={r.am}>
                          <td
                            style={{
                              ...TBLTD,
                              color: adColor(r.pct),
                              fontWeight: 500,
                            }}
                          >
                            {r.am}
                          </td>
                          <td style={{ ...TBLTD, color: "#777" }}>{r.cm}</td>
                          <td style={TBLTD}>{r.stores}</td>
                          <td style={TBLTD}>
                            <PBar pct={r.pct} />
                          </td>
                          <td style={TBLTD}>
                            <AdBadge pct={r.pct} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {dbTab === "stores" && (
              <>
                <div style={DBCARD}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#F0F0F0",
                      marginBottom: 8,
                    }}
                  >
                    All stores — tap to drill down
                  </div>
                  <input
                    type="text"
                    value={storeSearchDb}
                    onChange={(e) => setStoreSearchDb(e.target.value)}
                    placeholder="🔍 Search store…"
                    style={{
                      width: "100%",
                      background: "#2C2C2E",
                      border: `0.5px solid ${
                        storeSearchDb ? "#F5D000" : "#3A3A3C"
                      }`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "#F5D000",
                      fontFamily: "inherit",
                      marginBottom: 10,
                      boxSizing: "border-box" as const,
                    }}
                  />
                  <div style={{ overflowX: "auto" as const }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse" as const,
                        fontSize: 12,
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={TBLTH}>Store</th>
                          <th style={TBLTH}>Supervisor</th>
                          <th style={TBLTH}>Submitted</th>
                          <th style={TBLTH}>Expected</th>
                          <th style={TBLTH}>Adherence</th>
                          <th style={TBLTH}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeDataFiltered.map((r) => (
                          <tr
                            key={r.store}
                            style={{ cursor: "pointer" }}
                            onClick={() =>
                              setDrillStore(
                                drillStore === r.store ? null : r.store
                              )
                            }
                          >
                            <td
                              style={{
                                ...TBLTD,
                                color: adColor(r.pct),
                                fontWeight: 500,
                              }}
                            >
                              {r.store}
                            </td>
                            <td style={{ ...TBLTD, color: "#777" }}>{r.sup}</td>
                            <td
                              style={{
                                ...TBLTD,
                                color: "#4ADE80",
                                fontWeight: 600,
                              }}
                            >
                              {r.submitted}
                            </td>
                            <td style={{ ...TBLTD, color: "#777" }}>
                              {r.expected}
                            </td>
                            <td style={TBLTD}>
                              <PBar pct={r.pct} />
                            </td>
                            <td style={TBLTD}>
                              <AdBadge pct={r.pct} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {storeDataFiltered.length === 0 && (
                      <div
                        style={{
                          textAlign: "center",
                          padding: 20,
                          color: "#FF6B6B",
                          fontSize: 12,
                        }}
                      >
                        No stores match "{storeSearchDb}"
                      </div>
                    )}
                  </div>
                </div>
                {drillStore && (
                  <div style={DBCARD}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: adColor(drillAdh.pct),
                          }}
                        >
                          {drillStore}
                        </div>
                        <div
                          style={{ fontSize: 11, color: "#555", marginTop: 2 }}
                        >
                          Sup: {STORE_MAPPING[drillStore]?.supervisor} · AM:{" "}
                          {STORE_MAPPING[drillStore]?.am}
                        </div>
                      </div>
                      <AdBadge pct={drillAdh.pct} />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {[
                        { l: "Submitted", v: drillAdh.submitted, c: "#4ADE80" },
                        { l: "Expected", v: drillAdh.expected, c: "#777" },
                        {
                          l: "Adherence",
                          v: `${drillAdh.pct}%`,
                          c: adColor(drillAdh.pct),
                        },
                      ].map(({ l, v, c }) => (
                        <div
                          key={l}
                          style={{
                            background: "#2C2C2E",
                            borderRadius: 8,
                            padding: "8px 10px",
                            textAlign: "center" as const,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: "#666",
                              textTransform: "uppercase" as const,
                              letterSpacing: "0.06em",
                              marginBottom: 4,
                            }}
                          >
                            {l}
                          </div>
                          <div
                            style={{ fontSize: 18, fontWeight: 700, color: c }}
                          >
                            {v}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#555",
                        marginBottom: 6,
                        fontWeight: 600,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                      }}
                    >
                      Daily breakdown
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${drillDays.length},1fr)`,
                        gap: 4,
                        alignItems: "end",
                        height: 60,
                      }}
                    >
                      {drillDays.map(({ date, pct, label }) => (
                        <div
                          key={date}
                          style={{
                            display: "flex",
                            flexDirection: "column" as const,
                            alignItems: "center",
                            gap: 2,
                            height: "100%",
                            justifyContent: "flex-end",
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              borderRadius: "2px 2px 0 0",
                              minHeight: 2,
                              background: adColor(pct),
                              height: `${Math.max(pct, 2)}%`,
                            }}
                          />
                          <div style={{ fontSize: 9, color: "#444" }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {dbTab === "flagged" && (
              <div style={DBCARD}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#FF6B6B",
                      }}
                    >
                      Flagged — below {THRESHOLD}%
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                      Requires immediate attention
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background:
                        flaggedFiltered.length > 0 ? "#3A1A1A" : "#1E3A1E",
                      color: flaggedFiltered.length > 0 ? "#FF6B6B" : "#4ADE80",
                    }}
                  >
                    {flaggedFiltered.length} stores
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <FilterSelect
                    label="Supervisor"
                    value={flagSup}
                    onChange={setFlagSup}
                    options={allSups}
                  />
                  <FilterSelect
                    label="TL"
                    value={flagTL}
                    onChange={setFlagTL}
                    options={allTLs}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <FilterSelect
                    label="AM"
                    value={flagAM}
                    onChange={setFlagAM}
                    options={allAMs}
                  />
                  <FilterSelect
                    label="City Mgr"
                    value={flagCM}
                    onChange={setFlagCM}
                    options={allCMs}
                  />
                </div>
                {(flagSup || flagTL || flagAM || flagCM) && (
                  <button
                    onClick={() => {
                      setFlagSup("");
                      setFlagTL("");
                      setFlagAM("");
                      setFlagCM("");
                    }}
                    style={{
                      background: "none",
                      border: "0.5px solid #3A3A3C",
                      borderRadius: 8,
                      padding: "5px 12px",
                      fontSize: 11,
                      color: "#888",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      marginBottom: 12,
                    }}
                  >
                    ✕ Clear filters
                  </button>
                )}
                {flaggedFiltered.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 24,
                      color: "#4ADE80",
                      fontSize: 14,
                    }}
                  >
                    No flagged stores match the filters
                  </div>
                ) : (
                  flaggedFiltered.map((r) => (
                    <div
                      key={r.store}
                      className="ds-fade"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 0",
                        borderBottom: "0.5px solid #2A2A2A",
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: "#3A1A1A",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 15,
                          flexShrink: 0,
                        }}
                      >
                        ⚑
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#F0F0F0",
                            fontWeight: 500,
                          }}
                        >
                          {r.store}
                        </div>
                        <div
                          style={{ fontSize: 11, color: "#555", marginTop: 1 }}
                        >
                          TL: {r.tl} · Sup: {r.sup} · AM: {r.am}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            marginTop: 3,
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          <span style={{ color: "#4ADE80" }}>
                            ✓ {r.submitted} submitted
                          </span>
                          <span style={{ color: "#555" }}>
                            / {r.expected} expected
                          </span>
                          <span style={{ color: "#FF6B6B" }}>
                            {r.expected - r.submitted > 0
                              ? `${r.expected - r.submitted} missed`
                              : ""}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#FF6B6B",
                          flexShrink: 0,
                        }}
                      >
                        {r.pct}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {dbTab === "heatmap" && (
              <div style={DBCARD}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#F0F0F0",
                    marginBottom: 2,
                  }}
                >
                  Hourly heatmap · Today
                </div>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>
                  Real-time status · green = submitted, red = missed, grey =
                  upcoming
                </div>
                <input
                  type="text"
                  value={storeSearchDb}
                  onChange={(e) => setStoreSearchDb(e.target.value)}
                  placeholder="🔍 Filter stores…"
                  style={{
                    width: "100%",
                    background: "#2C2C2E",
                    border: `0.5px solid ${
                      storeSearchDb ? "#F5D000" : "#3A3A3C"
                    }`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "#F5D000",
                    fontFamily: "inherit",
                    marginBottom: 10,
                    boxSizing: "border-box" as const,
                  }}
                />
                <div style={{ overflowX: "auto" as const }}>
                  <table
                    style={{
                      borderCollapse: "collapse" as const,
                      fontSize: 10,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            ...TBLTH,
                            padding: "4px 6px",
                            position: "sticky" as const,
                            left: 0,
                            background: "#242426",
                          }}
                        >
                          Store
                        </th>
                        {heatmapShort.map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "4px 2px",
                              color: "#555",
                              fontWeight: 600,
                              fontSize: 9,
                              textAlign: "center" as const,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapStores.map((store) => {
                        const cells = heatmapForStore(store);
                        return (
                          <tr key={store}>
                            <td
                              style={{
                                padding: "3px 6px",
                                color: "#CCC",
                                whiteSpace: "nowrap" as const,
                                position: "sticky" as const,
                                left: 0,
                                background: "#242426",
                                fontSize: 10,
                                maxWidth: 90,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {store}
                            </td>
                            {cells.map((state, i) => {
                              const bg =
                                state === "submitted"
                                  ? "#1D9E75"
                                  : state === "missed"
                                  ? "#E24B4A"
                                  : "#3A3A3C";
                              const op =
                                state === "submitted"
                                  ? 1
                                  : state === "missed"
                                  ? 0.85
                                  : 0.5;
                              return (
                                <td key={i} style={{ padding: 2 }}>
                                  <div
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 3,
                                      background: bg,
                                      margin: "0 auto",
                                      opacity: op,
                                    }}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    marginTop: 12,
                    fontSize: 11,
                    color: "#777",
                    flexWrap: "wrap" as const,
                  }}
                >
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: "#1D9E75",
                        display: "inline-block",
                      }}
                    />
                    Submitted
                  </span>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: "#E24B4A",
                        opacity: 0.85,
                        display: "inline-block",
                      }}
                    />
                    Missed
                  </span>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: "#3A3A3C",
                        display: "inline-block",
                      }}
                    />
                    Upcoming
                  </span>
                </div>
              </div>
            )}

            {dbTab === "gallery" && (
              <div style={DBCARD}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#F0F0F0",
                    marginBottom: 8,
                  }}
                >
                  Photo review gallery
                </div>
                <select
                  value={galleryStore}
                  onChange={(e) => setGalleryStore(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#2C2C2E",
                    border: `0.5px solid ${
                      galleryStore ? "#F5D000" : "#3A3A3C"
                    }`,
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 13,
                    color: "#F5D000",
                    fontFamily: "inherit",
                    appearance: "none" as const,
                    marginBottom: 12,
                    boxSizing: "border-box" as const,
                  }}
                >
                  <option value="">— Select a store to view photos —</option>
                  {SCOPED_STORES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {!galleryStore && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 24,
                      color: "#555",
                      fontSize: 13,
                    }}
                  >
                    Choose a store to see its submitted photos
                  </div>
                )}
                {galleryStore && galleryRows.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 24,
                      color: "#777",
                      fontSize: 13,
                    }}
                  >
                    No submissions for {galleryStore} in this range
                  </div>
                )}
                {galleryRows.map((row, idx) => {
                  const links = parseFileLinks(row);
                  return (
                    <div
                      key={idx}
                      className="ds-fade"
                      style={{
                        marginBottom: 14,
                        paddingBottom: 12,
                        borderBottom: "0.5px solid #2A2A2A",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#F5D000",
                          }}
                        >
                          {extractDate(row.Date)} ·{" "}
                          {extractHourSlot(row.HourSlot)}
                        </div>
                        <span style={{ fontSize: 10, color: "#777" }}>
                          {row.TotalFiles} files
                        </span>
                      </div>
                      {links.length > 0 ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3,1fr)",
                            gap: 6,
                          }}
                        >
                          {links.map((lnk, i) => (
                            <a
                              key={i}
                              href={lnk}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "block",
                                aspectRatio: "1",
                                borderRadius: 8,
                                overflow: "hidden",
                                border: "0.5px solid #3A3A3C",
                                background: "#2C2C2E",
                              }}
                            >
                              <img
                                src={driveThumb(lnk)}
                                alt="submission"
                                loading="lazy"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <a
                          href={row.DriveLink || "#"}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, color: "#60A5FA" }}
                        >
                          Open folder in Drive →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── LOGIN VIEW ────────────────────────────────────────────────────────────
function LoginView({ onLogin }: { onLogin: (u: UserAccount) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    // Validates against the central Users sheet, then falls back to built-in
    // accounts (existing UAE logins / offline).
    const u = await loginAccount(username, password);
    setBusy(false);
    if (u) {
      setError("");
      onLogin(u);
    } else setError("Invalid username or password");
  }
  return (
    <div
      style={{
        background: "#1C1C1E",
        minHeight: "100vh",
        fontFamily: "system-ui,-apple-system,sans-serif",
        maxWidth: 520,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
      }}
    >
      <div style={{ marginBottom: 32, transform: "scale(1.3)" }}>
        <NoonLogo />
      </div>
      <div
        style={{
          width: "100%",
          background: "#242426",
          border: "0.5px solid #333335",
          borderRadius: 16,
          padding: "24px 20px",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#F0F0F0",
            marginBottom: 4,
          }}
        >
          Dashboard Login
        </div>
        <div style={{ fontSize: 12, color: "#777", marginBottom: 20 }}>
          Sign in to view operations data
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#777",
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          Username
        </div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Enter username"
          style={{
            width: "100%",
            background: "#2C2C2E",
            border: "0.5px solid #3A3A3C",
            borderRadius: 8,
            padding: "11px 12px",
            fontSize: 14,
            color: "#F5D000",
            fontFamily: "inherit",
            marginBottom: 14,
            boxSizing: "border-box" as const,
          }}
        />
        <div
          style={{
            fontSize: 10,
            color: "#777",
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          Password
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Enter password"
          style={{
            width: "100%",
            background: "#2C2C2E",
            border: "0.5px solid #3A3A3C",
            borderRadius: 8,
            padding: "11px 12px",
            fontSize: 14,
            color: "#F5D000",
            fontFamily: "inherit",
            marginBottom: 14,
            boxSizing: "border-box" as const,
          }}
        />
        {error && (
          <div
            style={{
              fontSize: 12,
              color: "#FF6B6B",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ⚠️ {error}
          </div>
        )}
        <button
          onClick={submit}
          style={{
            width: "100%",
            background: "#F5D000",
            color: "#1C1C1E",
            fontSize: 15,
            fontWeight: 800,
            border: "none",
            borderRadius: 10,
            padding: 14,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Sign In →
        </button>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#444",
          marginTop: 20,
          textAlign: "center" as const,
        }}
      >
        noon minutes · dark store operations · UAE
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<"upload" | "dashboard">("upload");
  const [user, setUser] = useState<UserAccount | null>(loadSession());
  // Seed from the last successful fetch synchronously so the FIRST render
  // already uses the most recent known list (not the older hard-coded one).
  const [storesVersion, setStoresVersion] = useState(() =>
    seedStoreMappingFromCache() ? 1 : 0
  );
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default")
      Notification.requestPermission();
  }, []);
  // Then fetch the live list. When it arrives, bump the version so the views
  // re-render with the fresh mapping/dropdown (and the cache is updated).
  useEffect(() => {
    loadLiveStoreMapping().then((ok) => {
      if (ok) setStoresVersion((v) => v + 1);
    });
  }, []);

  function handleLogin(u: UserAccount) {
    setUser(u);
    saveSession(u);
  }
  function handleLogout() {
    setUser(null);
    saveSession(null);
    setView("upload");
  }

  // Dashboard requires login; Upload is open to all (LAs need it without login)
  const showLogin = view === "dashboard" && !user;

  return (
    <div style={{ background: "#1C1C1E", minHeight: "100vh" }}>
      {view === "upload" && <UploadView key={`u${storesVersion}`} />}
      {view === "dashboard" &&
        (showLogin ? (
          <LoginView onLogin={handleLogin} />
        ) : (
          <DashboardView
            key={`d${storesVersion}`}
            user={user!}
            onLogout={handleLogout}
          />
        ))}
      {/* FIX: a fixed element with transform:translateX(-50%) is unreliable on
          mobile browsers — the transform creates a containing block that makes
          the bar drift during scroll. Use full-width fixed + centered inner. */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          width: "100%",
          background: "#242426",
          borderTop: "1px solid #2E2E30",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            display: "flex",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <button
            onClick={() => setView("upload")}
            style={{
              flex: 1,
              padding: "12px 0",
              background: "none",
              border: "none",
              borderRight: "0.5px solid #2E2E30",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              gap: 3,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={view === "upload" ? "#F5D000" : "#555"}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: view === "upload" ? "#F5D000" : "#555",
              }}
            >
              UPLOAD
            </span>
          </button>
          <button
            onClick={() => setView("dashboard")}
            style={{
              flex: 1,
              padding: "12px 0",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              gap: 3,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={view === "dashboard" ? "#F5D000" : "#555"}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: view === "dashboard" ? "#F5D000" : "#555",
              }}
            >
              DASHBOARD
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
