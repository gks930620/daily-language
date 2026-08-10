# 데이터베이스 vs 스키마 — DB마다 다르다

> 이 프로젝트를 Railway MySQL에 붙이면서 헷갈렸던 것을 정리해 둔다.
> 결론부터: **MySQL에서는 데이터베이스와 스키마가 같은 말이고, Oracle·PostgreSQL에서는 다르다.**

---

## 한 장 요약

| | 층 구조 | 데이터베이스 : 스키마 |
|---|---|---|
| **MySQL / MariaDB** | 서버 → **데이터베이스(=스키마)** → 테이블 | **같은 것** (동의어) |
| **PostgreSQL** | 서버 → 데이터베이스 → **스키마** → 테이블 | 1 : N |
| **Oracle** | 인스턴스 → 데이터베이스 → **스키마(=유저)** → 테이블 | 1 : N |
| **SQL Server** | 서버 → 데이터베이스 → **스키마** → 테이블 | 1 : N |

**MySQL만 2층이고 나머지는 3층이다.** 그래서 "데이터베이스 하나를 스키마로 나눈다"는 말이
다른 DB에서는 성립하지만 MySQL에서는 성립하지 않는다.

---

## MySQL — 데이터베이스 = 스키마

완전한 동의어다. 명령어도 서로 바꿔 쓸 수 있다.

```sql
CREATE DATABASE shop;   -- 이 둘은
CREATE SCHEMA   shop;   -- 완전히 같은 명령이다

SHOW DATABASES;   =   SHOW SCHEMAS;
```

구조는 2층뿐이다.

```
MySQL 서버 (한 대)
├── shop          ← 데이터베이스이자 스키마
├── blog          ← 데이터베이스이자 스키마   (shop 안이 아니라 옆)
└── analytics     ← 데이터베이스이자 스키마
```

`shop`, `blog`, `analytics`는 **형제**다. 무엇을 감싸는 부모가 없다.

앱을 분리하려면 → **데이터베이스를 따로 만든다.**
권한도 데이터베이스 단위로 준다:

```sql
GRANT ALL PRIVILEGES ON shop.* TO 'shop_user'@'%';
```

> 다른 데이터베이스의 테이블을 그냥 조인할 수 있다: `SELECT * FROM blog.posts JOIN shop.users ...`
> 이게 가능한 이유도 둘이 같은 층에 있는 이름공간이기 때문이다.

---

## PostgreSQL — 데이터베이스 안에 스키마가 여러 개

3층이다. 스키마를 안 만들면 기본 스키마 `public`에 들어간다.

```
PostgreSQL 서버
└── mydb                 ← 데이터베이스
    ├── public           ← 스키마
    ├── shop             ← 스키마
    └── blog             ← 스키마
```

앱을 분리하는 방법이 **두 가지**다.
- 스키마를 나눈다 (같은 데이터베이스 안 → 서로 조인 가능)
- 데이터베이스를 나눈다 (완전 분리 → **서로 조인 불가**, 접속을 새로 해야 함)

권한은 스키마 단위로도 줄 수 있다:

```sql
GRANT USAGE ON SCHEMA shop TO shop_user;
```

---

## Oracle — 스키마 = 유저

가장 헷갈리는 쪽이다. **유저를 만들면 같은 이름의 스키마가 생긴다.** 둘이 사실상 한 몸이다.

```sql
CREATE USER shop IDENTIFIED BY ...;   -- shop 유저 + shop 스키마가 같이 생긴다
```

```
Oracle 데이터베이스
├── SHOP        ← 스키마 = 유저
├── BLOG        ← 스키마 = 유저
└── HR          ← 스키마 = 유저
```

앱을 분리하려면 → **유저를 따로 만든다**(그게 곧 스키마 분리다).
Oracle 경험자가 "스키마로 나눈다"고 하면 보통 **"계정을 나눈다"**는 뜻이다.

> 12c 이후 멀티테넌트에서는 위에 층이 하나 더 붙는다: CDB(컨테이너) → PDB(플러그인 DB) → 스키마.

---

## 왜 헷갈리나 — Railway에서 겪은 실제 사례

Railway가 MySQL 서비스를 만들면 환경변수에 이런 게 들어 있다.

```
MYSQL_DATABASE="railway"
MYSQL_URL="mysql://root:...@host:3306/railway"
```

`MYSQL_DATABASE=railway` 라고 쓰여 있으니 **`railway`가 전체를 감싸는 것처럼 보인다.**
그 안에 `businesscard_qr` 같은 스키마들이 들어가는 것처럼.

**아니다.** `railway`는 Railway가 기본으로 하나 만들어 준 데이터베이스일 뿐이고,
나중에 만든 것들과 **형제**다.

```
total_mysql (MySQL 서버 한 대 = Railway의 "서비스")
├── railway           ← Railway 기본 (감싸는 게 아님)
├── businesscard_qr   ← Spring이 createDatabaseIfNotExist=true로 자동 생성
├── doll_gacha 용     ← 위와 같은 방식
└── daily_language    ← 이 프로젝트가 자동 생성
```

Spring이 `.../businesscard_qr`로 접속하는 것도 `railway` **안으로 들어가는 게 아니라
옆 칸에 붙는 것**이다.

### 정확한 표현

| ❌ 틀린 표현 (Oracle·PostgreSQL 감각) | ⭕ MySQL에서 맞는 표현 |
|---|---|
| "데이터베이스 1개를 스키마로 나눴다" | "데이터베이스(= 스키마)를 여러 개 만들어 프로젝트마다 하나씩 쓴다" |
| "railway 안에 businesscard_qr 스키마가 있다" | "railway와 businesscard_qr는 같은 서버 안의 다른 데이터베이스다" |
| "MySQL을 하나 더 만들어야 한다" | "MySQL 서버는 그대로, 데이터베이스만 하나 더 만든다" |

---

## 확인 명령어

```sql
-- 지금 서버에 어떤 데이터베이스(=스키마)가 있나
SHOW DATABASES;

-- 특정 데이터베이스의 테이블
SHOW TABLES IN daily_language;

-- 지금 어디에 붙어 있나
SELECT DATABASE();
```

---

## 이 프로젝트의 구성

```
total_mysql  (MySQL 서버 1대, Railway 서비스)
├── railway
├── businesscard_qr    ← Spring 프로젝트
├── doll_gacha 용
└── daily_language     ← 이 프로젝트  ← API 서버가 기동할 때 자동 생성
    ├── users
    └── study_log
```

- `DB_NAME=daily_language` 가 "이 데이터베이스를 쓰겠다"는 뜻이다.
- 없으면 API 서버가 `CREATE DATABASE IF NOT EXISTS`로 만든다
  (JDBC의 `createDatabaseIfNotExist=true`와 같은 일 — mysql2에는 그 옵션이 없어 직접 한다).
- 설정 절차는 [SETUP.md](SETUP.md), 서버 쪽 설명은 [api/README.md](api/README.md).
