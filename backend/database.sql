-- 1. Tạo các kiểu dữ liệu ENUM
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'HR');
CREATE TYPE "LogType" AS ENUM ('IN', 'OUT');
CREATE TYPE "Status" AS ENUM ('ON_TIME', 'LATE');

-- 2. Tạo bảng Department (Phòng ban)
CREATE TABLE "Department" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) UNIQUE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tạo bảng Admin (Quản trị viên)
CREATE TABLE "Admin" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "username" VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "Role" DEFAULT 'HR',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tạo bảng Employee (Nhân viên)
CREATE TABLE "Employee" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "employeeCode" VARCHAR(50) UNIQUE NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) UNIQUE,
    "phone" VARCHAR(20),
    "departmentId" UUID NOT NULL REFERENCES "Department"("id") ON DELETE RESTRICT,
    "avatarUrl" TEXT,
    "faceEmbedding" REAL[], -- Mảng số thực chứa vector khuôn mặt
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tạo bảng AttendanceLog (Lịch sử điểm danh)
CREATE TABLE "AttendanceLog" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
    "checkTime" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "type" "LogType" NOT NULL,
    "status" "Status" DEFAULT 'ON_TIME',
    "snapshotUrl" TEXT,
    "confidenceScore" REAL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- (Tuỳ chọn) Tạo extension vector nếu sau này bạn muốn tối ưu tìm kiếm khuôn mặt cực nhanh bằng pgvector
-- CREATE EXTENSION IF NOT EXISTS vector;
-- Sau đó đổi cột faceEmbedding thành kiểu vector(512):
-- ALTER TABLE "Employee" ALTER COLUMN "faceEmbedding" TYPE vector(512);
