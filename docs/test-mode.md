# 🧪 Test Mode Guide

Test Mode ช่วยให้คุณทดสอบ Class Schedule Sync โดยไม่ต้องใส่ API Keys จริงๆ ระบบจะใช้ Mock Services แทน

## 🚀 Quick Start

### วิธีที่ 1: ใช้ Script (แนะนำ)
```bash
# เริ่ม Test Mode
npm run test-mode

# หรือ
npm run dev:test
```

### วิธีที่ 2: Manual Setup
```bash
# Copy test environment files
cp apps/api/.env.test apps/api/.env
cp apps/web/.env.test apps/web/.env

# Start development servers
npm run dev
```

## 🔧 Test Mode Features

### ✅ Mock Services ที่เปิดใช้งาน
- **Google OAuth**: ไม่ต้องใส่ Client ID/Secret จริง
- **Google Calendar API**: ใช้ Mock Calendar และ Events
- **Redis**: ใช้ In-Memory Mock แทน Redis จริง
- **Database**: ใช้ SQLite in-memory (optional)

### 🎯 Test Endpoints
เมื่อเริ่ม Test Mode แล้ว คุณสามารถเข้าถึง endpoints เหล่านี้:

```bash
# ตรวจสอบสถานะ Test Mode
GET http://localhost:3001/test-mode/status

# ข้อมูลตัวอย่าง
GET http://localhost:3001/test-mode/sample-data
GET http://localhost:3001/test-mode/sample-data?type=subjects

# Mock Authentication
POST http://localhost:3001/test-mode/mock-auth
{
  "email": "test@example.com",
  "name": "Test User"
}

# Google Calendar Mock Status
GET http://localhost:3001/test-mode/google-calendar-mock

# Health Check
GET http://localhost:3001/health
```

## 📊 Sample Data

Test Mode มาพร้อมกับข้อมูลตัวอย่าง:

### Subjects (วิชา)
- Software Project Management (960200)
- Database Systems (960300)  
- Web Development (960400)

### Sections (ตอนเรียน)
- SPM Section 001: จันทร์/พุธ 09:00-10:30 ห้อง 301
- DB Section 002: อังคาร/พฤหัส 13:00-14:30 Lab 201

### Mock Google Calendar
- Primary Calendar
- Secondary Test Calendar
- Mock Events ที่ sync แล้ว

## 🧪 Testing Scenarios

### 1. Authentication Flow
```bash
# 1. เข้า http://localhost:3000
# 2. คลิก "Sign in with Google" 
# 3. จะได้ Mock User: test.user@example.com
```

### 2. Quick Add Class
```bash
# POST /api/subjects/quick-add
{
  "subjectName": "Test Subject",
  "sectionCode": "001",
  "days": ["MO", "WE"],
  "startTime": "09:00",
  "endTime": "10:30",
  "room": "Room 101",
  "startDate": "2024-01-15",
  "endDate": "2024-05-15"
}
```

### 3. Google Calendar Sync
```bash
# POST /api/sync/google
{
  "direction": "upsert-to-google",
  "range": {
    "from": "2024-01-01",
    "to": "2024-12-31"
  }
}
```

### 4. Import CSV
```bash
# POST /api/import/upload
# Upload CSV file with sample data
```

## 🔍 Debugging Test Mode

### ตรวจสอบสถานะ
```bash
# ตรวจสอบว่า Test Mode เปิดอยู่
npm run test-mode --status

# ดู environment variables
cat apps/api/.env
cat apps/web/.env
```

### Log Levels
Test Mode ใช้ `LOG_LEVEL=debug` เพื่อให้เห็น logs ทั้งหมด

### Mock Service Status
```bash
curl http://localhost:3001/test-mode/status
```

## 🛠️ Customizing Test Mode

### เพิ่ม Mock Data
แก้ไขไฟล์ `apps/api/src/common/controllers/test-mode.controller.ts`:

```typescript
const sampleData = {
  subjects: [
    // เพิ่มวิชาใหม่
    {
      id: 4,
      name: "Your Custom Subject",
      code: "960500",
      color: "#8B5CF6",
    }
  ]
};
```

### เปลี่ยน Mock User
แก้ไขไฟล์ `apps/api/src/common/mocks/mock-google-oauth.service.ts`:

```typescript
async getUserInfo(accessToken: string) {
  return {
    id: 'your-mock-user-id',
    email: 'your-email@example.com',
    name: 'Your Name',
    // ...
  };
}
```

### เพิ่ม Mock Calendar Events
แก้ไขไฟล์ `apps/api/src/common/mocks/mock-google-calendar.service.ts`

## 🔄 Reset Test Environment

```bash
# รีเซ็ต environment files
npm run test-mode --reset

# รีเซ็ต test data ผ่าน API
curl -X POST http://localhost:3001/test-mode/reset-data
```

## 🚨 Troubleshooting

### ปัญหาที่พบบ่อย

**1. Port ถูกใช้งานแล้ว**
```bash
# หา process ที่ใช้ port 3001
lsof -ti:3001 | xargs kill -9

# หรือเปลี่ยน port ใน .env
PORT=3002
```

**2. Dependencies ไม่ครบ**
```bash
# ลบ node_modules และติดตั้งใหม่
rm -rf node_modules
npm install
```

**3. Mock Services ไม่ทำงาน**
```bash
# ตรวจสอบ environment variables
grep ENABLE_MOCK_MODE apps/api/.env
# ควรได้: ENABLE_MOCK_MODE=true
```

**4. Database Error**
```bash
# ใช้ SQLite in-memory แทน
DATABASE_URL=sqlite::memory:
```

## 📝 Environment Variables

### API (.env)
```bash
NODE_ENV=test
PORT=3001
DATABASE_URL=sqlite::memory:
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret-for-development-only-32-chars
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
GOOGLE_CLIENT_ID=mock-google-client-id
GOOGLE_CLIENT_SECRET=mock-google-client-secret
FRONTEND_URL=http://localhost:3000
ENABLE_MOCK_MODE=true
ENABLE_GOOGLE_API_MOCK=true
ENABLE_REDIS_MOCK=true
LOG_LEVEL=debug
```

### Web (.env)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=mock-google-client-id
NEXT_PUBLIC_APP_ENV=test
NEXT_PUBLIC_ENABLE_MOCK_MODE=true
```

## 🎯 Next Steps

เมื่อทดสอบเสร็จแล้ว และพร้อม deploy จริง:

1. **สร้าง Production Environment**
   ```bash
   cp apps/api/.env.production apps/api/.env
   cp apps/web/.env.production apps/web/.env
   ```

2. **ใส่ API Keys จริง**
   - Google OAuth Client ID/Secret
   - Database URL (Supabase)
   - Redis URL (Redis Cloud)

3. **Deploy**
   ```bash
   npm run check:deployment
   npm run test:all
   ```

## 💡 Tips

- ใช้ Test Mode สำหรับ development และ demo
- ข้อมูลใน Test Mode จะหายเมื่อ restart server
- Mock Services จำลองการทำงานของ API จริงๆ
- สามารถใช้ Test Mode สำหรับ automated testing ได้

---

Happy Testing! 🧪✨