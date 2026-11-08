// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract FreelanceEscrow {
    enum Status { Created, Funded, Submitted, Disputed, Paid, Refunded }
    struct Job {
        address payable employer;
        address payable freelancer;
        string title;
        string description;
        uint256 amount;
        uint256 deadline;
        string proof;
        Status status;
    }
    address public immutable admin;
    uint256 public jobCount;
    mapping(uint256 => Job) private jobs;
    uint256 private lockState = 1;

    event JobCreated(uint256 indexed jobId, address indexed employer, address indexed freelancer, uint256 amount);
    event Deposited(uint256 indexed jobId, uint256 amount);
    event WorkSubmitted(uint256 indexed jobId, string proof);
    event DisputeOpened(uint256 indexed jobId, address indexed by);
    event PaymentReleased(uint256 indexed jobId, address indexed to, uint256 amount);
    event Refunded(uint256 indexed jobId, address indexed to, uint256 amount);

    modifier nonReentrant() {
        require(lockState == 1, "Reentrant call");
        lockState = 2;
        _;
        lockState = 1;
    }
    modifier exists(uint256 id) { require(id > 0 && id <= jobCount, "Job not found"); _; }

    constructor() { admin = msg.sender; }

    function createJob(string calldata title, string calldata description, address payable freelancer, uint256 deadline, uint256 amount) external returns (uint256) {
        require(bytes(title).length > 0 && bytes(description).length > 0, "Missing details");
        require(freelancer != address(0) && freelancer != msg.sender, "Invalid freelancer");
        require(amount > 0, "Invalid amount");
        require(deadline > block.timestamp, "Deadline must be future");
        uint256 id = ++jobCount;
        jobs[id] = Job(payable(msg.sender), freelancer, title, description, amount, deadline, "", Status.Created);
        emit JobCreated(id, msg.sender, freelancer, amount);
        return id;
    }

    function deposit(uint256 id) external payable exists(id) {
        Job storage job = jobs[id];
        require(msg.sender == job.employer, "Only employer");
        require(job.status == Status.Created, "Not awaiting deposit");
        require(msg.value == job.amount, "Incorrect deposit");
        job.status = Status.Funded;
        emit Deposited(id, msg.value);
    }

    function submitWork(uint256 id, string calldata proof) external exists(id) {
        Job storage job = jobs[id];
        require(msg.sender == job.freelancer, "Only freelancer");
        require(job.status == Status.Funded, "Not funded");
        require(block.timestamp <= job.deadline, "Deadline passed");
        require(bytes(proof).length > 0, "Proof required");
        job.proof = proof;
        job.status = Status.Submitted;
        emit WorkSubmitted(id, proof);
    }

    function approve(uint256 id) external exists(id) nonReentrant {
        Job storage job = jobs[id];
        require(msg.sender == job.employer, "Only employer");
        require(job.status == Status.Submitted, "Work not submitted or disputed");
        job.status = Status.Paid;
        (bool ok,) = job.freelancer.call{value: job.amount}("");
        require(ok, "Transfer failed");
        emit PaymentReleased(id, job.freelancer, job.amount);
    }

    function openDispute(uint256 id) external exists(id) {
        Job storage job = jobs[id];
        require(msg.sender == job.employer || msg.sender == job.freelancer, "Not a party");
        require(job.status == Status.Funded || job.status == Status.Submitted, "Cannot dispute");
        job.status = Status.Disputed;
        emit DisputeOpened(id, msg.sender);
    }

    function resolveDispute(uint256 id, bool payFreelancer) external exists(id) nonReentrant {
        require(msg.sender == admin, "Only admin");
        Job storage job = jobs[id];
        require(job.status == Status.Disputed, "Not disputed");
        address payable recipient = payFreelancer ? job.freelancer : job.employer;
        job.status = payFreelancer ? Status.Paid : Status.Refunded;
        (bool ok,) = recipient.call{value: job.amount}("");
        require(ok, "Transfer failed");
        if (payFreelancer) emit PaymentReleased(id, recipient, job.amount);
        else emit Refunded(id, recipient, job.amount);
    }

    function getJob(uint256 id) external view exists(id) returns (Job memory) { return jobs[id]; }
}
