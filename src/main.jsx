import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";
import "./style.css";

const ABI = [
  "function admin() view returns (address)",
  "function jobCount() view returns (uint256)",
  "function createJob(string title,string description,address freelancer,uint256 deadline,uint256 amount) returns (uint256)",
  "function deposit(uint256 id) payable",
  "function submitWork(uint256 id,string proof)",
  "function approve(uint256 id)",
  "function openDispute(uint256 id)",
  "function resolveDispute(uint256 id,bool payFreelancer)",
  "function getJob(uint256 id) view returns (tuple(address employer,address freelancer,string title,string description,uint256 amount,uint256 deadline,string proof,uint8 status))",
  "event JobCreated(uint256 indexed jobId,address indexed employer,address indexed freelancer,uint256 amount)",
  "event Deposited(uint256 indexed jobId,uint256 amount)",
  "event WorkSubmitted(uint256 indexed jobId,string proof)",
  "event DisputeOpened(uint256 indexed jobId,address indexed by)",
  "event PaymentReleased(uint256 indexed jobId,address indexed to,uint256 amount)",
  "event Refunded(uint256 indexed jobId,address indexed to,uint256 amount)",
];
const STATUS = [
  "รอฝากเงิน",
  "ฝากเงินแล้ว",
  "ส่งงานแล้ว",
  "มีข้อพิพาท",
  "จ่ายเงินแล้ว",
  "คืนเงินแล้ว",
];
const ROLES = [
  { id: "employer", label: "ผู้ว่าจ้าง", icon: "▣" },
  { id: "freelancer", label: "ฟรีแลนซ์", icon: "◈" },
  { id: "admin", label: "ผู้ดูแลระบบ", icon: "⚖" },
];
const CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS;
const INFURA = import.meta.env.VITE_INFURA_PROJECT_ID;
const eq = (a, b) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "—");
const money = (n) => ethers.formatEther(n);
const date = (n) => new Date(Number(n) * 1000).toLocaleString("th-TH");
const errorText = (e) =>
  e?.reason ||
  e?.shortMessage ||
  e?.info?.error?.message ||
  e?.message ||
  String(e);
function App() {
  const [account, setAccount] = useState("");
  const [admin, setAdmin] = useState("");
  const [jobs, setJobs] = useState([]);
  const [role, setRole] = useState("employer");
  const [form, setForm] = useState({
    title: "",
    description: "",
    freelancer: "",
    deadline: "",
    amount: "",
  });
  const [proofs, setProofs] = useState({});
  const [txs, setTxs] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const validConfig = Boolean(INFURA && ethers.isAddress(CONTRACT || ""));
  const reader = useMemo(
    () =>
      validConfig
        ? new ethers.Contract(
            CONTRACT,
            ABI,
            new ethers.JsonRpcProvider(
              `https://sepolia.infura.io/v3/${INFURA}`,
            ),
          )
        : null,
    [validConfig],
  );
  async function refresh() {
    if (!reader) return;
    setLoading(true);
    try {
      const [count, owner] = await Promise.all([
        reader.jobCount(),
        reader.admin(),
      ]);
      setAdmin(owner);
      const total = Number(count);
      const results = [];
      for (let start = 1; start <= total; start += 20) {
        const ids = Array.from(
          { length: Math.min(20, total - start + 1) },
          (_, i) => start + i,
        );
        results.push(
          ...(await Promise.all(
            ids.map(async (id) => ({ id, data: await reader.getJob(id) })),
          )),
        );
      }
      setJobs(results.reverse());
    } catch (e) {
      setMessage("อ่านข้อมูลไม่สำเร็จ: " + errorText(e));
    } finally {
      setLoading(false);
    }
  }
  async function syncWallet() {
    if (!window.ethereum) {
      setAccount("");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      setAccount(chain?.toLowerCase() === "0xaa36a7" ? accounts[0] || "" : "");
      if (accounts.length && chain?.toLowerCase() !== "0xaa36a7")
        setMessage("กรุณาเลือกเครือข่าย Sepolia ใน MetaMask");
    } catch (e) {
      setMessage(errorText(e));
    }
  }
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setAccount("");
      } else {
        setAccount(accounts[0]);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);
  useEffect(() => {
    refresh();
    syncWallet();
    if (!window.ethereum) return;
    const update = () => syncWallet();
    window.ethereum.on("accountsChanged", update);
    window.ethereum.on("chainChanged", update);
    return () => {
      window.ethereum.removeListener("accountsChanged", update);
      window.ethereum.removeListener("chainChanged", update);
    };
  }, [reader]);
  async function connect() {
    if (!window.ethereum) {
      setMessage("กรุณาติดตั้ง MetaMask");
      return;
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
      } catch (e) {
        if (e.code === 4902) {
          setMessage("กรุณาเพิ่ม Sepolia Testnet ใน MetaMask ก่อน");
          return;
        }
        throw e;
      }
      await syncWallet();
      setMessage("เชื่อมต่อกระเป๋าสำเร็จ");
    } catch (e) {
      setMessage(errorText(e));
    }
  }
  async function transact(method, args = [], overrides) {
    if (!reader || !account) {
      setMessage("กรุณาตั้งค่า .env และเชื่อมต่อ MetaMask");
      return;
    }
    setBusy(true);
    setMessage("กรุณายืนยันธุรกรรมใน MetaMask");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) throw Error("กรุณาเลือก Sepolia");
      const signer = await provider.getSigner();
      if (!eq(await signer.getAddress(), account))
        throw Error("บัญชี MetaMask เปลี่ยน กรุณาลองใหม่");
      const writer = reader.connect(signer);
      const tx = overrides
        ? await writer[method](...args, overrides)
        : await writer[method](...args);
      setMessage("กำลังรอการยืนยันธุรกรรม...");
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw Error("ธุรกรรมไม่สำเร็จ");
      setTxs((old) => [
        { method, hash: tx.hash, block: receipt.blockNumber },
        ...old,
      ]);
      setMessage(`สำเร็จ: ${method} (${short(tx.hash)})`);
      await refresh();
    } catch (e) {
      setMessage("ทำรายการไม่สำเร็จ: " + errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function create(e) {
    e.preventDefault();
    try {
      if (!ethers.isAddress(form.freelancer))
        throw Error("Wallet Address ฟรีแลนซ์ไม่ถูกต้อง");
      if (eq(form.freelancer, account))
        throw Error("ผู้ว่าจ้างและฟรีแลนซ์ต้องใช้คนละ Wallet");
      const deadline = Math.floor(new Date(form.deadline).getTime() / 1000);
      if (!Number.isFinite(deadline) || deadline <= Date.now() / 1000)
        throw Error("กำหนดส่งต้องเป็นเวลาในอนาคต");
      const amount = ethers.parseEther(form.amount);
      if (amount <= 0n) throw Error("ค่าจ้างต้องมากกว่า 0");
      await transact("createJob", [
        form.title.trim(),
        form.description.trim(),
        form.freelancer,
        BigInt(deadline),
        amount,
      ]);
    } catch (e) {
      setMessage(errorText(e));
    }
  }
  const mine = jobs.filter((j) => eq(j.data.employer, account));
  const assigned = jobs.filter((j) => eq(j.data.freelancer, account));
  const disputes = jobs.filter((j) => Number(j.data.status) === 3);
  const isAdmin = eq(admin, account);
  const shown =
    role === "employer" ? mine : role === "freelancer" ? assigned : disputes;
  const title = ROLES.find((r) => r.id === role)?.label;
  const pending = shown.filter(
    (j) => ![4, 5].includes(Number(j.data.status)),
  ).length;
  function JobCard({ item }) {
    const { id, data: j } = item;
    const status = Number(j.status);
    return (
      <article className="job">
        <div className="between">
          <div>
            <span className="eyebrow">สัญญา #{id}</span>
            <h3>{j.title}</h3>
          </div>
          <span className={`status status-${status}`}>{STATUS[status]}</span>
        </div>
        <p className="description">{j.description}</p>
        <div className="details">
          <div>
            <small>ค่าจ้าง</small>
            <strong>{money(j.amount)} ETH</strong>
          </div>
          <div>
            <small>กำหนดส่ง</small>
            <strong>{date(j.deadline)}</strong>
          </div>
        </div>
        <div className="wallets">
          <div>
            ผู้ว่าจ้าง: <code title={j.employer}>{short(j.employer)}</code>
          </div>
          <div>
            ฟรีแลนซ์: <code title={j.freelancer}>{short(j.freelancer)}</code>
          </div>
        </div>
        {j.proof && (
          <p className="proof">
            <b>หลักฐานงาน:</b> <span className="break">{j.proof}</span>
          </p>
        )}
        <div className="actions">
          {role === "employer" && eq(j.employer, account) && status === 0 && (
            <button
              disabled={busy}
              onClick={() => transact("deposit", [id], { value: j.amount })}
            >
              ฝากเงิน {money(j.amount)} ETH
            </button>
          )}
          {role === "freelancer" &&
            eq(j.freelancer, account) &&
            status === 1 && (
              <div className="submit">
                <input
                  aria-label={`หลักฐานงาน ${id}`}
                  placeholder="URL หรือ IPFS Hash ของผลงาน"
                  value={proofs[id] || ""}
                  onChange={(e) =>
                    setProofs((old) => ({ ...old, [id]: e.target.value }))
                  }
                />
                <button
                  disabled={busy || !(proofs[id] || "").trim()}
                  onClick={() =>
                    transact("submitWork", [id, proofs[id].trim()])
                  }
                >
                  ส่งงาน
                </button>
              </div>
            )}
          {role === "employer" && eq(j.employer, account) && status === 2 && (
            <button disabled={busy} onClick={() => transact("approve", [id])}>
              อนุมัติและจ่ายเงิน
            </button>
          )}
          {["employer", "freelancer"].includes(role) &&
            (eq(j.employer, account) || eq(j.freelancer, account)) &&
            [1, 2].includes(status) && (
              <button
                className="danger-outline"
                disabled={busy}
                onClick={() => transact("openDispute", [id])}
              >
                เปิดข้อพิพาท
              </button>
            )}
          {role === "admin" && isAdmin && status === 3 && (
            <>
              <button
                disabled={busy}
                onClick={() => transact("resolveDispute", [id, true])}
              >
                จ่ายให้ฟรีแลนซ์
              </button>
              <button
                className="danger-outline"
                disabled={busy}
                onClick={() => transact("resolveDispute", [id, false])}
              >
                คืนเงินผู้ว่าจ้าง
              </button>
            </>
          )}
        </div>
      </article>
    );
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">◆</div>
          <div>
            <b>DigitalWork</b>
            <small>Escrow Platform</small>
          </div>
        </div>
        <p className="nav-label">แดชบอร์ด</p>
        <nav>
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={`nav-item ${role === r.id ? "active" : ""}`}
              onClick={() => setRole(r.id)}
            >
              <span>{r.icon}</span>
              {r.label}
              {r.id === "admin" && isAdmin && disputes.length > 0 && (
                <em>{disputes.length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="dot" /> Ethereum Sepolia{" "}
          <small>Smart Contract Escrow</small>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">FREELANCE ESCROW</span>
            <h1>แดชบอร์ด{title}</h1>
            <p>จัดการสัญญาจ้างงานและชำระเงินผ่าน Ethereum</p>
          </div>
          <button className="wallet-btn" onClick={connect}>
            {account ? `◉ ${short(account)}` : "เชื่อมต่อ MetaMask"}
          </button>
        </header>
        {!validConfig && (
          <div className="notice">
            กรุณาสร้างไฟล์ .env และกำหนด VITE_INFURA_PROJECT_ID กับ
            VITE_CONTRACT_ADDRESS แล้วรีสตาร์ต Vite
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        {!account && (
          <div className="notice">
            เชื่อมต่อ MetaMask บนเครือข่าย Sepolia
            เพื่อดูงานและทำธุรกรรมตามสิทธิ์ของ Wallet
          </div>
        )}
        {role === "admin" && !isAdmin && (
          <div className="notice">
            โหมดดูข้อมูลเท่านั้น: Wallet นี้ไม่ใช่ Admin ของ Smart Contract
            จึงไม่สามารถตัดสินข้อพิพาทได้
          </div>
        )}
        <div className="stats">
          <div className="stat">
            <span>งานในหน้านี้</span>
            <strong>{shown.length}</strong>
            <small>
              {role === "admin" ? "ข้อพิพาทที่รอตัดสิน" : "สัญญาที่เกี่ยวข้อง"}
            </small>
          </div>
          <div className="stat">
            <span>กำลังดำเนินการ</span>
            <strong>{pending}</strong>
            <small>ยังไม่ปิดสัญญา</small>
          </div>
          <div className="stat">
            <span>มูลค่างานรวม</span>
            <strong className="eth">
              {ethers.formatEther(
                shown.reduce((sum, j) => sum + j.data.amount, 0n),
              )}{" "}
              ETH
            </strong>
            <small>หน่วยทดสอบ Sepolia ETH</small>
          </div>
        </div>
        {role === "employer" && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>สร้างสัญญาจ้างใหม่</h2>
                <p>ระบุข้อตกลงและ Wallet ของฟรีแลนซ์</p>
              </div>
            </div>
            <form className="create-form" onSubmit={create}>
              <label>
                ชื่อโครงการ
                <input
                  required
                  placeholder="เช่น ออกแบบเว็บไซต์บริษัท"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label>
                Wallet Address ฟรีแลนซ์
                <input
                  required
                  placeholder="0x..."
                  value={form.freelancer}
                  onChange={(e) =>
                    setForm({ ...form, freelancer: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                รายละเอียดงาน
                <textarea
                  required
                  placeholder="ขอบเขตงานและสิ่งที่ต้องส่งมอบ"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
              <label>
                กำหนดส่ง
                <input
                  required
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) =>
                    setForm({ ...form, deadline: e.target.value })
                  }
                />
              </label>
              <label>
                ค่าจ้าง (ETH)
                <input
                  required
                  type="number"
                  min="0.000000000000000001"
                  step="any"
                  placeholder="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </label>
              <div className="wide">
                <button disabled={busy || !account || !validConfig}>
                  + สร้างสัญญาจ้าง
                </button>
              </div>
            </form>
          </section>
        )}
        <section className="panel">
          <div className="panel-head between">
            <div>
              <h2>
                {role === "employer"
                  ? "งานที่ฉันว่าจ้าง"
                  : role === "freelancer"
                    ? "งานที่ได้รับมอบหมาย"
                    : "ข้อพิพาทที่รอการตัดสิน"}
              </h2>
              <p>
                {role === "freelancer"
                  ? "แสดงเฉพาะงานที่ระบุ Wallet ของคุณเป็นฟรีแลนซ์"
                  : role === "admin"
                    ? "Admin สามารถจ่ายเงินหรือคืนเงินตามการพิจารณา"
                    : "ติดตามสถานะการฝากเงิน การส่งงาน และการอนุมัติ"}
              </p>
            </div>
            <button className="secondary" disabled={loading} onClick={refresh}>
              {loading ? "กำลังโหลด..." : "↻ รีเฟรช"}
            </button>
          </div>
          {!account && role !== "admin" ? (
            <div className="empty">
              กรุณาเชื่อมต่อ MetaMask เพื่อแสดงงานของคุณ
            </div>
          ) : shown.length === 0 ? (
            <div className="empty">
              {role === "admin"
                ? "ยังไม่มีข้อพิพาทที่รอตัดสิน"
                : "ยังไม่มีงานในบทบาทนี้"}
            </div>
          ) : (
            <div className="job-list">
              {shown.map((item) => (
                <JobCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>ประวัติธุรกรรมในเซสชันนี้</h2>
            <p>ธุรกรรมที่ส่งจากเบราว์เซอร์นี้ตั้งแต่เปิดหน้าเว็บ</p>
          </div>
          {txs.length === 0 ? (
            <div className="empty">ยังไม่มีธุรกรรมในเซสชันนี้</div>
          ) : (
            txs.map((t) => (
              <div className="tx" key={t.hash}>
                <span>
                  {t.method} · Block {t.block}
                </span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${t.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(t.hash)} ↗
                </a>
              </div>
            ))
          )}
          <p className="footnote">
            ประวัติย้อนหลังและ Events ตรวจสอบได้จาก Sepolia Etherscan ของ
            Contract Address
          </p>
        </section>
        <footer>
          DigitalWork Solutions · Ethereum Sepolia Testnet ·
          สำหรับการศึกษาและทดสอบเท่านั้น
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
