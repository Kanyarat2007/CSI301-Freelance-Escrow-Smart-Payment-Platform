# DigitalWork — Freelance Escrow & Smart Payment Platform

แพลตฟอร์มจ้างงานฟรีแลนซ์และชำระเงินตามผลงานผ่าน **Ethereum Smart Contract (Escrow)** โดยเก็บเงินค่าจ้างไว้ในสัญญาจนกว่าผู้ว่าจ้างจะอนุมัติผลงาน หรือผู้ดูแลระบบจะตัดสินข้อพิพาท

> **สถานะโปรเจกต์:** ต้นแบบสำหรับการเรียนรู้และทดสอบบน **Sepolia Testnet** เท่านั้น ยังไม่ได้ตรวจสอบความปลอดภัยเพื่อใช้กับเงินจริง

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 18, Vite, CSS, Lucide React Icons |
| Backend | Node.js, Express |
| Database | MySQL |
| Authentication | MetaMask, Ethers.js v6, การลงนามข้อความด้วย Wallet, Session Cookie |
| Blockchain | Ethereum Sepolia, Solidity, Infura RPC |
| Smart Contract | `contracts/FreelanceEscrow.sol` |

## บทบาทผู้ใช้งาน (Roles)

### 1. Employer — ผู้ว่าจ้าง

ผู้ว่าจ้างสมัครสมาชิกด้วย Wallet และเลือกบทบาท **Employer** จากนั้นสามารถ:

- สร้างสัญญาจ้าง ระบุชื่อโครงการ รายละเอียดงาน ที่อยู่ Wallet ของฟรีแลนซ์ กำหนดส่ง และค่าจ้างเป็น ETH
- ฝากเงินตามจำนวนค่าจ้างเข้า Smart Contract (Escrow)
- ตรวจสอบหลักฐานส่งงานที่ฟรีแลนซ์บันทึกไว้
- อนุมัติผลงานเพื่อให้ Smart Contract จ่าย ETH ให้ฟรีแลนซ์
- เปิดข้อพิพาทในงานที่ฝากเงินแล้วหรือส่งงานแล้ว
- ดูรายการงานของตน สถานะ และลิงก์ธุรกรรม

**ข้อจำกัด:** ผู้ว่าจ้างอนุมัติจ่ายได้เฉพาะงานที่ตนเป็นผู้ว่าจ้างและมีสถานะ `Submitted` เท่านั้น

### 2. Freelancer — ผู้รับจ้าง

ฟรีแลนซ์สมัครสมาชิกด้วย Wallet อีกบัญชีและเลือกบทบาท **Freelancer** จากนั้นสามารถ:

- ดูเฉพาะสัญญาที่ระบุ Wallet ของตนเป็นผู้รับจ้าง
- ตรวจสอบรายละเอียดงาน ค่าจ้าง กำหนดส่ง และสถานะการฝากเงิน
- ส่งหลักฐานผลงานในรูปแบบ URL หรือ Hash ผ่านฟังก์ชัน `submitWork`
- เปิดข้อพิพาทเมื่อเกิดปัญหาในงานที่มีสิทธิ์
- ติดตามสถานะการอนุมัติและการจ่ายเงิน

**ข้อจำกัด:** ส่งงานได้เมื่อสัญญามีสถานะ `Funded` และยังไม่เลยกำหนดส่งเท่านั้น

### 3. Admin — ผู้ดูแลระบบ

Admin เป็นบัญชีที่ได้รับสิทธิ์โดยผู้ดูแลระบบ **ไม่สามารถเลือกสมัครเป็น Admin จากหน้า Register ได้** โดยสามารถ:

- ดูรายการสัญญาที่อยู่ในสถานะ `Disputed`
- พิจารณาข้อพิพาทและเลือก **จ่ายค่าจ้างให้ Freelancer** หรือ **คืนเงินให้ Employer**
- ตรวจสอบผลการดำเนินการผ่านสถานะและ Event บน Blockchain

**สำคัญ:** Wallet ของ Admin ต้องตรงกับ `admin()` ที่กำหนดไว้ใน Smart Contract ตั้งแต่ Deploy และบทบาทใน MySQL ต้องเป็น `admin` ด้วย

### ตารางสิทธิ์การใช้งานบนหน้าเว็บ

| ความสามารถ | Employer | Freelancer | Admin |
|---|:---:|:---:|:---:|
| สมัครสมาชิกทั่วไป | ✓ | ✓ | — |
| สร้างสัญญา | ✓ | — | — |
| ฝาก ETH | ✓ | — | — |
| ส่งหลักฐานงาน | — | ✓ | — |
| อนุมัติและจ่ายเงิน | ✓ | — | — |
| เปิดข้อพิพาท | ✓ | ✓ | — |
| ตัดสินข้อพิพาท | — | — | ✓ |
| ดูงานตามบทบาท | ✓ | ✓ | ✓ (ข้อพิพาท) |

> **หมายเหตุด้านสิทธิ์:** ตารางนี้อธิบายข้อจำกัดใน **Frontend** เท่านั้น Smart Contract เดิมไม่ได้อ่านบทบาทจาก MySQL และยังอนุญาตให้ Wallet เดียวกันเป็น Employer ในงานหนึ่งและ Freelancer ในอีกงานหนึ่งได้ การป้องกันธุรกรรมบน Blockchain ใช้การตรวจสอบผู้ว่าจ้าง/ผู้รับจ้าง **รายสัญญา** และ Admin ตาม Wallet ที่ Deploy หากต้องการบังคับบทบาทแยกขาดในระดับ Blockchain จำเป็นต้องปรับ Smart Contract และ Deploy ใหม่

## ขั้นตอนการทำงานของระบบ

```text
เชื่อมต่อ MetaMask
       ↓
สมัครสมาชิก / Login ด้วยการลงนามข้อความ
       ↓
ตรวจสอบบทบาทจาก MySQL
       ↓
Employer สร้างสัญญา (Created)
       ↓
Employer ฝาก ETH (Funded)
       ↓
Freelancer ส่งงาน (Submitted)
       ↓
  ┌───────────────────────┐
  │ Employer อนุมัติ?     │
  └───────────────────────┘
      │ ใช่          │ เปิดข้อพิพาท
      ↓               ↓
 Paid (จ่าย ETH)    Disputed
                      ↓
                Admin ตัดสิน
                 ↙       ↘
             Paid        Refunded
```

### สถานะ Smart Contract

| รหัส | สถานะ | ความหมาย |
|---|---|---|
| 0 | `Created` | สร้างสัญญาแล้ว ยังไม่ฝากเงิน |
| 1 | `Funded` | ฝากเงินเข้า Escrow แล้ว |
| 2 | `Submitted` | ฟรีแลนซ์ส่งหลักฐานผลงานแล้ว |
| 3 | `Disputed` | เปิดข้อพิพาท รอ Admin ตัดสิน |
| 4 | `Paid` | จ่ายค่าจ้างให้ฟรีแลนซ์แล้ว |
| 5 | `Refunded` | คืนเงินให้ผู้ว่าจ้างแล้ว |

## โครงสร้างโปรเจกต์

```text
freelance-escrow/
├── contracts/
│   └── FreelanceEscrow.sol  # Smart Contract
├── src/
│   ├── main.jsx             # React UI, Login, Dashboard, Ethers.js
│   └── style.css            # ธีมและ Responsive UI
├── server/
│   ├── index.js             # Express API / Wallet Authentication
│   ├── schema.sql           # โครงสร้างฐานข้อมูล MySQL
│   ├── package.json
│   └── .env.example
├── index.html
├── package.json
├── .env.example
└── README.md
```

## ติดตั้งและเริ่มใช้งาน

### สิ่งที่ต้องเตรียม

- Node.js 20+ และ npm
- MySQL 8+
- MetaMask ที่เลือกเครือข่าย Ethereum Sepolia และมี Sepolia ETH สำหรับ Gas
- Infura Project ID สำหรับ Sepolia
- Contract Address ของ `FreelanceEscrow.sol` ที่ Deploy บน Sepolia แล้ว

### 1. สร้างฐานข้อมูล

เปิด MySQL Workbench แล้วรัน `server/schema.sql` เพื่อสร้างฐานข้อมูลและตารางที่ใช้กับระบบสมัครสมาชิก

### 2. ตั้งค่า Backend

คัดลอก `server/.env.example` เป็น `server/.env` และแก้ค่าตามเครื่องของคุณ:

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=YOUR_MYSQL_PASSWORD
MYSQL_DATABASE=freelance_escrow
SESSION_HOURS=12
CHAIN_ID=11155111
CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT
ADMIN_WALLET=0xYOUR_CONTRACT_ADMIN
```

### 3. ตั้งค่า Frontend

คัดลอก `.env.example` เป็น `.env` ในโฟลเดอร์หลัก:

```env
VITE_INFURA_PROJECT_ID=YOUR_INFURA_PROJECT_ID
VITE_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT
VITE_API_URL=http://localhost:4000
```

**ห้าม Commit `.env`, รหัสผ่านฐานข้อมูล, Private Key หรือ Secret ลง GitHub** และต้องใช้ Contract Address เดียวกันทั้งสองฝั่ง

### 4. เปิด Backend และ Frontend

Terminal 1:

```bash
cd server
npm install
npm run dev
```

Terminal 2 (ที่โฟลเดอร์หลัก):

```bash
npm install
npm run dev
```

เปิด `http://localhost:5173` และเชื่อม MetaMask บน Sepolia

## การสมัครสมาชิกและเข้าสู่ระบบ

1. กดเชื่อมต่อ MetaMask
2. เลือก **สมัครสมาชิก** สำหรับ Wallet ใหม่
3. กรอกชื่อ อีเมล และเลือก Employer หรือ Freelancer
4. ลงนามข้อความยืนยัน Wallet (ไม่เสีย Gas)
5. ระบบบันทึกข้อมูลใน MySQL และสร้าง Session สำหรับเข้า Dashboard
6. ครั้งถัดไปเลือก **เข้าสู่ระบบ** และลงนามข้อความใหม่

Backend ใช้ Challenge แบบใช้ครั้งเดียว มีอายุประมาณ 5 นาที และ Session Cookie แบบ HttpOnly/SameSite สำหรับต้นแบบบน localhost

### การตั้งค่า Admin

หลังจาก Wallet ที่ Deploy Smart Contract ลงทะเบียนเป็นผู้ใช้แล้ว ให้ผู้ดูแลฐานข้อมูลกำหนดบทบาท:

```sql
UPDATE users
SET role = 'admin'
WHERE wallet_address = '0xYOUR_DEPLOYER_ADDRESS';
```

จากนั้น Logout และ Login ใหม่ด้วย Wallet ดังกล่าว โดยตรวจสอบว่าตรงกับ `admin()` ของ Smart Contract จริง

## ตัวอย่างทดสอบครบกระบวนการ

1. Wallet A สมัครเป็น Employer
2. Wallet B สมัครเป็น Freelancer
3. Wallet A สร้างงานและใส่ Wallet B เป็นผู้รับจ้าง กำหนดค่าจ้าง เช่น `0.01 ETH`
4. Wallet A ฝาก `0.01 ETH` เข้า Escrow
5. Wallet B เข้าสู่ระบบและส่ง URL/Hash ผลงาน
6. Wallet A ตรวจสอบและอนุมัติ → สถานะ `Paid`
7. สำหรับทดสอบข้อพิพาท ให้สร้าง **งานใหม่** ฝากเงิน และเปิดข้อพิพาท
8. Wallet Admin เข้าสู่ระบบและเลือกจ่ายให้ฟรีแลนซ์หรือคืนให้ผู้ว่าจ้าง
9. ตรวจสอบ Transaction Hash บน [Sepolia Etherscan](https://sepolia.etherscan.io/)

## ความปลอดภัยและข้อจำกัด

- Smart Contract ป้องกันการจ่ายซ้ำด้วยการตรวจสอบสถานะก่อนโอนและมี Reentrancy Guard
- เงิน Escrow ไม่สามารถถอนผ่านฟังก์ชันปกติได้ก่อนเข้าเงื่อนไขอนุมัติหรือการตัดสินข้อพิพาท
- ไม่มีระบบจ่ายหรือคืนเงินอัตโนมัติเมื่อเกิน Deadline; ต้องจัดการตามฟังก์ชันที่มี
- การสมัครสมาชิกด้วย Wallet ไม่ได้เปลี่ยนสิทธิ์ภายใน Smart Contract เดิม
- URL/Hash ที่ส่งเป็นเพียงหลักฐานอ้างอิง ระบบไม่ได้ตรวจสอบคุณภาพผลงานอัตโนมัติ
- ต้องเสริม HTTPS, Secure Cookies, CSRF Protection, การตรวจสอบรูปแบบ SIWE ที่เข้มงวด และ Security Audit ก่อนใช้จริง
- ใช้ **Sepolia ETH** เท่านั้น ไม่ควรใช้เงินจริงกับต้นแบบ

## อ้างอิง

- [Remix IDE](https://remix.ethereum.org/)
- [MetaMask](https://metamask.io/)
- [Ethers.js](https://docs.ethers.org/v6/)
- [Infura / MetaMask Developer](https://developer.metamask.io/)
- [Sepolia Etherscan](https://sepolia.etherscan.io/)
