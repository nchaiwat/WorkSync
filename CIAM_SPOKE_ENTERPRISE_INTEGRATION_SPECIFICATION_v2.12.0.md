# ข้อกำหนดมาตรฐานกลาง: การเชื่อมต่อระบบลูกกับ Central IAM ผ่าน System Settings & Transaction Logs
**Standard Specification:** Enterprise Central IAM Integration for Spoke Applications  
**Current Version:** 2.12.0 (Enterprise Local Password Policy, 90-Day Forced Rotation & Complexity Framework Standard)  
**Effective Date:** 12 พฤศจิกายน 2026 (12/11/2026)  
**Organization:** บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) (Window Asia Public Company Limited)  
**Target Systems:** IRM, QMS, QOL (QT-Online), SAP B1 Service, MTPulse, WorkSync, ระบบงาน On-Premise ในโรงงาน และระบบงานทั้งหมดที่จะพัฒนาขึ้นใหม่  
**Compliance:** ISO 27001 / OpenID Connect (OIDC) / OAuth 2.0 with PKCE (RFC 7636) / OAuth 2.0 Security BCP (RFC 9700) / Model Context Protocol (MCP)

---

## 0. ประวัติการแก้ไขเอกสารและบันทึกการเปลี่ยนแปลง (Document Revision History & Changelog)

ตารางบันทึกประวัติการปรับปรุงข้อกำหนดมาตรฐาน เพื่อให้ทีมพัฒนาทุกระบบ (Spoke Teams) สามารถตรวจสอบย้อนกลับและทราบความแตกต่างของข้อกำหนดในแต่ละเวอร์ชันตามมาตรฐาน ISO 27001:

| เวอร์ชัน (Version) | วันที่มีผล (Date) | สถานะ (Status) | สรุปรายการปรับปรุงจากเวอร์ชันก่อนหน้า (Change Summary & Key Differences) |
| :---: | :---: | :---: | :--- |
| **v2.12.0** | 12/11/2026 | **Current Active** | • **หมวด G (ข้อกำหนดที่ 13): Enterprise Local Password Policy & 90-Day Rotation Framework Standard (มาตรฐานความปลอดภัยรหัสผ่านบัญชีท้องถิ่น และการบังคับเปลี่ยนรหัสผ่านทุก 90 วัน สำหรับระบบลูก):**<br/>1) **90-Day Forced Password Rotation:** บัญชีท้องถิ่น (Local Accounts), บัญชีฉุกเฉิน (Break-Glass Local Admin), และบัญชีเฉพาะระบบที่ไม่ได้ยืนยันตัวตนผ่าน Active Directory ในระบบลูกทุกระบบ ต้องมีคอลัมน์ `password_changed_at` และมีกลไกบังคับเปลี่ยนรหัสผ่านทุกๆ 90 วันโดยเด็ดขาด<br/>2) **Strict Password Complexity Requirements:** ความยาว 8 - 16 ตัวอักษร, มีตัวพิมพ์ใหญ่ (A-Z) &ge; 1, ตัวพิมพ์เล็ก (a-z) &ge; 1, ตัวเลข (0-9) &ge; 1, อักขระพิเศษ (!@#$%^&*...) &ge; 1 และห้ามมี Username ปะปนอยู่ในรหัสผ่าน<br/>3) **Forced Password Change Interception:** เมื่อรหัสผ่านครบ 90 วัน หรือ `must_change_password = true` ระบบลูกต้องบล็อกการเข้าสู่หน้าระบบงาน และบังคับเปิด Modal เปลี่ยนรหัสผ่านทันที (ห้ามข้าม)<br/>4) **Ready-to-Use Framework Implementation:** โค้ดตัวอย่างสำเร็จรูปสำหรับ Python (FastAPI/SQLAlchemy), Node.js (Express/TypeScript), PHP (PDO/Native) และ React Form |
| **v2.11.0** | 10/11/2026 | Superseded | • **หมวด D.7: มาตรฐานการแบ่งแยกระบบ Direct Infra vs SSO Spoke, สิทธิ์ต่ำสุด (Least Privilege), การเทียบเวลา (Timestamp Reconciliation) และการล็อคสิทธิ์เด็ดขาด (CIAM Authority Lock)** |
| **v2.10.0** | 09/11/2026 | Superseded | • **หมวด F: Enterprise In-App Bot Defense & Anti-Brute-Force Framework Standard:** กำหนดมาตรฐานการป้องกันบอทและ Brute-Force ภายในแอปพลิเคชัน 3 ชั้น (3-Layer Defense) สำหรับ Spoke ทุกระบบ ได้แก่ 1) Sliding-Window IP Rate Limiting 10 req/min, 2) Decoy Honeypot Trap ฟิลด์หลอก `corporate_fax` / `security_honey`, 3) Form Submission Velocity & Timing Guard (< 400ms rejection) |
| **v2.9.0** | 22/10/2026 | Superseded | • **หมวด D.6: True 2-Way Bi-directional Status Sync & Origin Tracking** |
| **v2.8.0** | 17/10/2026 | Superseded | • **หมวด E: ข้อกำหนดมาตรฐาน In-App AI Copilot & MCP Tools ประจำระบบลูก (Spoke AI Assistant & Dynamic Settings Standard)** |
| **v2.7.0** | 08/10/2026 | Superseded | • **Mode C Two-Way Directory Reconciliation & Auto-Provisioning** |
