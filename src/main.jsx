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
  "function openDispute(uint256 id,string reason,string evidenceURI)",
  "function getDispute(uint256 id) view returns (tuple(address openedBy,string reason,string evidenceURI,uint256 openedAt,bool exists))",
  "function resolveDispute(uint256 id,bool payFreelancer)",
  "function getJob(uint256 id) view returns (tuple(address employer,address freelancer,string title,string description,uint256 amount,uint256 deadline,string proof,uint8 status))",
  "event JobCreated(uint256 indexed jobId,address indexed employer,address indexed freelancer,uint256 amount)",
  "event Deposited(uint256 indexed jobId,uint256 amount)",
  "event WorkSubmitted(uint256 indexed jobId,string proof)",
  "event DisputeOpened(uint256 indexed jobId,address indexed by,string reason,string evidenceURI,uint256 openedAt)",
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
// Set to the new contract deployment block for complete history.
const DEPLOYMENT_BLOCK = Number(import.meta.env.VITE_DEPLOYMENT_BLOCK || 0);
const TX_LABELS = {
  JobCreated: "สร้างสัญญาจ้าง",
  Deposited: "ฝากเงินเข้า Escrow",
  WorkSubmitted: "ส่งมอบผลงาน",
  DisputeOpened: "เปิดข้อพิพาท",
  PaymentReleased: "จ่ายเงินให้ฟรีแลนซ์",
  Refunded: "คืนเงินให้ผู้ว่าจ้าง",
};
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

function JobCard({
  item,
  disputeDetails,
  role,
  account,
  busy,
  proofs,
  setProofs,
  disputeForms,
  setDisputeForms,
  isAdmin,
  transact,
  submitDispute,
}) {
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
      {disputeDetails[id]?.exists && (
        <div
          className="proof"
          style={{ marginTop: 12, overflowWrap: "anywhere" }}
        >
          <b>รายละเอียดข้อพิพาท</b>
          <p>ผู้แจ้ง: {short(disputeDetails[id].openedBy)}</p>
          <p>สาเหตุ: {disputeDetails[id].reason}</p>
          {disputeDetails[id].evidenceURI && (
            <p>
              หลักฐาน:{" "}
              <a
                href={
                  /^https:\/\//i.test(disputeDetails[id].evidenceURI)
                    ? disputeDetails[id].evidenceURI
                    : undefined
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                {disputeDetails[id].evidenceURI}
              </a>
            </p>
          )}
          <small>เปิดเมื่อ: {date(disputeDetails[id].openedAt)}</small>
        </div>
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
        {role === "freelancer" && eq(j.freelancer, account) && status === 1 && (
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
              onClick={() => transact("submitWork", [id, proofs[id].trim()])}
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
            <div
              className="dispute-form"
              style={{
                width: "100%",
                display: "grid",
                gap: 10,
                marginTop: 12,
              }}
            >
              <label>
                สาเหตุข้อพิพาท (จำเป็น)
                <textarea
                  placeholder="อธิบายปัญหาที่เกิดขึ้นเพื่อให้ Admin พิจารณา"
                  value={disputeForms[id]?.reason || ""}
                  onChange={(e) =>
                    setDisputeForms((old) => ({
                      ...old,
                      [id]: { ...old[id], reason: e.target.value },
                    }))
                  }
                  rows={3}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                URL หลักฐาน (ไม่บังคับ)
                <input
                  type="url"
                  placeholder="https://..."
                  value={disputeForms[id]?.evidenceURI || ""}
                  onChange={(e) =>
                    setDisputeForms((old) => ({
                      ...old,
                      [id]: { ...old[id], evidenceURI: e.target.value },
                    }))
                  }
                  style={{ width: "100%" }}
                />
              </label>
              <button
                className="danger-outline"
                disabled={busy || !(disputeForms[id]?.reason || "").trim()}
                onClick={() => submitDispute(id)}
              >
                เปิดข้อพิพาทพร้อมบันทึกสาเหตุ
              </button>
              <small>ข้อความและ URL จะถูกบันทึกบน Blockchain แบบสาธารณะ</small>
            </div>
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
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [disputeForms, setDisputeForms] = useState({});
  const [disputeDetails, setDisputeDetails] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  // Dashboard: show the newest job, with paginated access to all jobs.
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [jobPage, setJobPage] = useState(1);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
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
  async function loadHistory(visibleJobs, currentAccount, currentAdmin) {
    if (!reader) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const provider = reader.runner;
      const latest = await provider.getBlockNumber();
      // Without deployment block, scan only the most recent 10,000 blocks.
      const startBlock =
        DEPLOYMENT_BLOCK > 0 ? DEPLOYMENT_BLOCK : Math.max(0, latest - 10000);
      if (startBlock > latest)
        throw Error("VITE_DEPLOYMENT_BLOCK exceeds current block");
      const isOwner = eq(currentAccount, currentAdmin);
      const allowedIds = new Set(
        visibleJobs
          .filter(
            (j) =>
              isOwner ||
              eq(j.data.employer, currentAccount) ||
              eq(j.data.freelancer, currentAccount),
          )
          .map((j) => j.id),
      );
      if (!currentAccount) {
        setTxs([]);
        return;
      }
      const eventNames = Object.keys(TX_LABELS);
      const found = [];
      // Chunk eth_getLogs calls for RPC compatibility.
      for (let from = startBlock; from <= latest; from += 2000) {
        const to = Math.min(latest, from + 1999);
        const chunks = await Promise.all(
          eventNames.map((name) =>
            reader.queryFilter(reader.filters[name](), from, to),
          ),
        );
        for (let i = 0; i < chunks.length; i++) {
          for (const log of chunks[i]) {
            const jobId = Number(log.args.jobId);
            if (allowedIds.has(jobId))
              found.push({
                method: eventNames[i],
                jobId,
                hash: log.transactionHash,
                block: log.blockNumber,
                logIndex: log.index,
                amount: [
                  "Deposited",
                  "PaymentReleased",
                  "Refunded",
                  "JobCreated",
                ].includes(eventNames[i])
                  ? log.args.amount
                  : null,
              });
          }
        }
      }
      found.sort((a, b) => b.block - a.block || b.logIndex - a.logIndex);
      const blockDates = new Map();
      const display = found.slice(0, 100);
      for (const block of [...new Set(display.map((x) => x.block))]) {
        const info = await provider.getBlock(block);
        if (info) blockDates.set(block, Number(info.timestamp));
      }
      setTxs(
        display.map((x) => ({ ...x, timestamp: blockDates.get(x.block) })),
      );
    } catch (e) {
      setHistoryError("โหลดประวัติจาก Blockchain ไม่สำเร็จ: " + errorText(e));
    } finally {
      setHistoryLoading(false);
    }
  }

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
      const sorted = results.reverse();
      setJobs(sorted);
      // Read dispute reasons for admin and involved wallets (public on-chain data).
      const relevant = sorted.filter((j) => Number(j.data.status) >= 3);
      const infos = await Promise.all(
        relevant.map(async (j) => {
          try {
            return [j.id, await reader.getDispute(j.id)];
          } catch {
            return [j.id, null];
          }
        }),
      );
      setDisputeDetails(Object.fromEntries(infos));
      const wallets = window.ethereum
        ? await window.ethereum.request({ method: "eth_accounts" })
        : [];
      const chain = window.ethereum
        ? await window.ethereum.request({ method: "eth_chainId" })
        : "";
      await loadHistory(
        sorted,
        chain?.toLowerCase() === "0xaa36a7" ? wallets[0] || "" : "",
        owner,
      );
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
  useEffect(() => {
    if (reader && account) refresh();
    else if (!account) setTxs([]);
  }, [account]);
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
  async function submitDispute(id) {
    const data = disputeForms[id] || {};
    const reason = (data.reason || "").trim();
    const evidenceURI = (data.evidenceURI || "").trim();
    if (!reason || new TextEncoder().encode(reason).length > 500) {
      setMessage("กรุณากรอกสาเหตุ (ไม่เกิน 500 ไบต์)");
      return;
    }
    if (new TextEncoder().encode(evidenceURI).length > 300) {
      setMessage("ลิงก์หลักฐานยาวเกิน 300 ไบต์");
      return;
    }
    await transact("openDispute", [id, reason, evidenceURI]);
  }
  const mine = jobs.filter((j) => eq(j.data.employer, account));
  const assigned = jobs.filter((j) => eq(j.data.freelancer, account));
  const disputes = jobs.filter((j) => Number(j.data.status) === 3);
  const isAdmin = eq(admin, account);
  const shown =
    role === "employer" ? mine : role === "freelancer" ? assigned : disputes;
  const JOB_PAGE_SIZE = 5;
  const HISTORY_PAGE_SIZE = 10;
  const jobPages = Math.max(1, Math.ceil(shown.length / JOB_PAGE_SIZE));
  const historyPages = Math.max(1, Math.ceil(txs.length / HISTORY_PAGE_SIZE));
  const visibleJobs = showAllJobs
    ? shown.slice((Math.min(jobPage, jobPages) - 1) * JOB_PAGE_SIZE, Math.min(jobPage, jobPages) * JOB_PAGE_SIZE)
    : shown.slice(0, 1);
  const visibleHistory = showAllHistory
    ? txs.slice((Math.min(historyPage, historyPages) - 1) * HISTORY_PAGE_SIZE, Math.min(historyPage, historyPages) * HISTORY_PAGE_SIZE)
    : txs.slice(0, 5);
  const changeRole = (nextRole) => {
    setRole(nextRole);
    setShowAllJobs(false);
    setJobPage(1);
  };
  const title = ROLES.find((r) => r.id === role)?.label;
  const pending = shown.filter(
    (j) => ![4, 5].includes(Number(j.data.status)),
  ).length;

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
              onClick={() => changeRole(r.id)}
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
              {visibleJobs.map((item) => (
                <JobCard
                  key={item.id}
                  item={item}
                  disputeDetails={disputeDetails}
                  role={role}
                  account={account}
                  busy={busy}
                  proofs={proofs}
                  setProofs={setProofs}
                  disputeForms={disputeForms}
                  setDisputeForms={setDisputeForms}
                  isAdmin={isAdmin}
                  transact={transact}
                  submitDispute={submitDispute}
                />
              ))}
              {shown.length > 1 && (
                <div className="list-controls">
                  <span className="list-count">{showAllJobs
                    ? `แสดง ${Math.min((jobPage - 1) * JOB_PAGE_SIZE + 1, shown.length)}–${Math.min(jobPage * JOB_PAGE_SIZE, shown.length)} จาก ${shown.length} งาน`
                    : `แสดงงานล่าสุด 1 จาก ${shown.length} งาน`}</span>
                  {showAllJobs && jobPages > 1 && (
                    <div className="pagination" aria-label="แบ่งหน้างาน">
                      <button className="secondary" disabled={jobPage <= 1} onClick={() => setJobPage(p => p - 1)}>ก่อนหน้า</button>
                      <span>หน้า {jobPage} / {jobPages}</span>
                      <button className="secondary" disabled={jobPage >= jobPages} onClick={() => setJobPage(p => p + 1)}>ถัดไป</button>
                    </div>
                  )}
                  <button className="secondary" onClick={() => { setShowAllJobs(v => !v); setJobPage(1); }}>
                    {showAllJobs ? "ย่อเหลืองานล่าสุด" : `ดูงานทั้งหมด (${shown.length})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head between">
            <div>
              <h2>ประวัติธุรกรรมบน Blockchain</h2>
              {/* <p>
                อ่าน Events จาก Sepolia และตรวจสอบย้อนหลังได้แม้รีเฟรชหน้าเว็บ
              </p> */}
            </div>
            <button
              className="secondary"
              disabled={loading || historyLoading}
              onClick={refresh}
            >
              ↻ รีเฟรช
            </button>
          </div>
          {historyError && <p className="notice">{historyError}</p>}
          {historyLoading ? (
            <p>กำลังอ่านประวัติจาก Blockchain...</p>
          ) : txs.length === 0 ? (
            <div className="empty">ไม่พบประวัติในช่วงบล็อกที่ค้นหา</div>
          ) : (
            visibleHistory.map((t) => (
              <div
                className="tx"
                key={`${t.hash}-${t.logIndex}`}
                style={{ alignItems: "flex-start", gap: 12 }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <strong>
                    {TX_LABELS[t.method]} · งาน #{t.jobId}
                  </strong>
                  <small>
                    ยืนยันแล้ว · Block #{t.block}
                    {t.timestamp ? ` · ${date(t.timestamp)}` : ""}
                  </small>
                  {t.amount !== null && (
                    <small>จำนวน {money(t.amount)} ETH</small>
                  )}
                </div>
                <a
                  href={`https://sepolia.etherscan.io/tx/${t.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t.hash}
                >
                  {short(t.hash)} ↗
                </a>
              </div>
            ))
          )}
          {!historyLoading && txs.length > 5 && (
            <div className="list-controls">
              <span className="list-count">{showAllHistory
                ? `แสดง ${Math.min((historyPage - 1) * HISTORY_PAGE_SIZE + 1, txs.length)}–${Math.min(historyPage * HISTORY_PAGE_SIZE, txs.length)} จาก ${txs.length} รายการ`
                : `แสดง 5 รายการล่าสุด จาก ${txs.length} รายการ`}</span>
              {showAllHistory && historyPages > 1 && (
                <div className="pagination" aria-label="แบ่งหน้าประวัติธุรกรรม">
                  <button className="secondary" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>ก่อนหน้า</button>
                  <span>หน้า {historyPage} / {historyPages}</span>
                  <button className="secondary" disabled={historyPage >= historyPages} onClick={() => setHistoryPage(p => p + 1)}>ถัดไป</button>
                </div>
              )}
              <button className="secondary" onClick={() => { setShowAllHistory(v => !v); setHistoryPage(1); }}>
                {showAllHistory ? "ย่อเหลือรายการล่าสุด" : `ดูประวัติทั้งหมด (${txs.length})`}
              </button>
            </div>
          )}
          {/* <p className="footnote">
            {DEPLOYMENT_BLOCK > 0
              ? `เริ่มค้นหาจาก Block #${DEPLOYMENT_BLOCK}`
              : "ยังไม่ได้กำหนด VITE_DEPLOYMENT_BLOCK จึงค้นหาเฉพาะ 10,000 บล็อกล่าสุด"}
            {" · "}แสดงสูงสุด 100 Events ล่าสุดของงานที่เกี่ยวข้องกับ Wallet
            (Admin เห็นทุกงาน)
          </p> */}
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
