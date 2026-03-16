# MoodBubble iOS — 项目计划书

> 从 Next.js Web 版迁移到 Swift 原生 iOS App 的完整技术方案

---

## 一、项目概述

**MoodBubble** 是一个地图情绪日记平台，用户在地图上记录心情、查看朋友的情绪气泡、接收位置/时间记忆提醒。

**iOS 版目标**：用 Swift 原生重写，采用本地优先架构（Private mood 存本地，Friends mood 同步云端），体验更 Apple、更流畅、更省云端资源。

---

## 二、技术栈

| 层 | 技术 | 版本要求 | 用途 |
|----|------|---------|------|
| **语言** | Swift | 5.9+ | 全部代码 |
| **UI** | SwiftUI | iOS 17+ | 界面 |
| **地图** | MapKit | iOS 17+ | 替代 React Leaflet |
| **本地数据库** | SwiftData | iOS 17+ | 替代 Web localStorage |
| **云端后端** | Supabase | — | Auth + DB + Storage + Realtime |
| **Supabase SDK** | supabase-swift | 2.x | Swift 原生 SDK |
| **图片缓存** | Kingfisher | 8.x | 网络图片加载+缓存 |
| **定位** | CoreLocation | — | GPS + 地理围栏 |
| **推送** | APNs + Supabase Edge Function | — | 朋友 mood 推送 |
| **Watch** | WatchConnectivity + SwiftUI | watchOS 10+ | 快速记录心情 |
| **最低系统** | iOS 17.0 | — | SwiftData 需要 iOS 17 |

---

## 三、架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    iPhone App                            │
│                                                         │
│  ┌─────────────────┐      ┌───────────────────────────┐│
│  │   SwiftData      │      │  Supabase Swift SDK       ││
│  │   (本地数据库)    │      │                           ││
│  │                  │      │  • Auth (登录/注册)        ││
│  │  • ALL moods     │─同步─▶│  • mood_entries (friends) ││
│  │  • 离线可用       │      │  • mood_reactions (独立表) ││
│  │  • 搜索/筛选     │      │  • profiles               ││
│  │  • 图片本地存     │      │  • friendships            ││
│  │                  │◀─拉取─│  • Storage (friends图片)  ││
│  └─────────────────┘      │  • Realtime (实时推送)     ││
│                           └───────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐   │
│  │               UI Layer (SwiftUI)                 │   │
│  │  • MapKit (原生地图 + 气泡标注)                   │   │
│  │  • Core Animation (emoji 漂浮动画)               │   │
│  │  • CoreLocation (GPS + 地理围栏)                 │   │
│  │  • Haptic Feedback (触觉反馈)                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
          │
          │ WatchConnectivity
          ▼
┌─────────────────────┐
│   Apple Watch App    │
│  • 快速记录心情       │
│  • 查看今日摘要       │
│  • 好友 mood 通知     │
└─────────────────────┘
          
          │ 仅 friends 数据 + auth
          ▼
┌─────────────────────────────┐
│       Supabase Cloud         │
│  • Auth (用户认证)            │
│  • mood_entries (friends 的)  │
│  • mood_reactions (独立表)    │
│  • profiles                  │
│  • friendships               │
│  • Storage (friends 图片)     │
│  • Realtime (WebSocket)      │
│  • Edge Function (APNs 推送)  │
└─────────────────────────────┘
```

### 3.2 数据流

```
创建 Private Mood:
  SwiftUI Form → SwiftData INSERT → 完成（不联网）
  图片 → App 沙盒 Documents 目录

创建 Friends Mood:
  SwiftUI Form → SwiftData INSERT (本地备份)
               → Supabase INSERT (云端)
               → Storage 上传图片
               → Realtime 自动推给朋友

查看地图:
  SwiftData 查自己所有 mood → MapKit Annotation
  Supabase 查朋友 friends mood → 叠加到地图

切换 Private ↔ Friends:
  Private → Friends: 本地数据 + 图片上传到 Supabase
  Friends → Private: 从 Supabase 删除，本地保留
```

---

## 四、Supabase 数据库迁移

### 4.1 保留不变的表

```sql
-- profiles (不变)
profiles: id, display_name, avatar_url, created_at, updated_at

-- friendships (不变)
friendships: id, requester_id, addressee_id, status, created_at, updated_at
```

### 4.2 修改的表

```sql
-- mood_entries: 删除 reactions JSONB 列
ALTER TABLE mood_entries DROP COLUMN IF EXISTS reactions;

-- mood_entries 只存 visibility='friends' 的数据
-- Private mood 不再进这个表，存在用户设备本地
```

### 4.3 新建的表

```sql
-- mood_reactions: 独立表，替代 JSONB
CREATE TABLE mood_reactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mood_id uuid NOT NULL REFERENCES mood_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mood_id, user_id, emoji)
);

ALTER TABLE mood_reactions ENABLE ROW LEVEL SECURITY;

-- 所有已登录用户可读
CREATE POLICY "Read reactions" ON mood_reactions
  FOR SELECT TO authenticated USING (true);

-- 只能添加自己的 reaction
CREATE POLICY "Add own reaction" ON mood_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 只能删除自己的 reaction
CREATE POLICY "Delete own reaction" ON mood_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
```

### 4.4 开启 Realtime

```
Supabase Dashboard → Database → Replication
→ 对 mood_entries 开启 Realtime
→ 朋友发 mood 时 Swift 端实时收到
```

---

## 五、SwiftData 本地数据模型

```swift
// Models/MoodEntry.swift
import SwiftData
import Foundation

@Model
class LocalMoodEntry {
    @Attribute(.unique) var id: UUID
    var userId: String
    var latitude: Double
    var longitude: Double
    var emotionScore: Int          // 0-100
    var category: String           // "social", "nature", etc.
    var note: String?
    var localImagePath: String?    // 本地图片路径
    var remoteImageUrl: String?    // Supabase Storage URL (friends only)
    var visibility: String         // "private" or "friends"
    var isSynced: Bool             // friends mood 是否已同步到云端
    var remoteId: String?          // Supabase 中的 UUID (friends only)
    var createdAt: Date
    
    init(/* ... */) { /* ... */ }
}
```

```swift
// Models/FriendMoodEntry.swift
// 从 Supabase 拉取的朋友 mood，也缓存到本地
@Model
class FriendMoodEntry {
    @Attribute(.unique) var remoteId: String
    var userId: String
    var authorName: String
    var authorAvatarUrl: String?
    var latitude: Double
    var longitude: Double
    var emotionScore: Int
    var category: String
    var note: String?
    var imageUrl: String?
    var createdAt: Date
    var isRead: Bool              // 是否已读（红点逻辑）
}
```

---

## 六、Web → iOS 功能映射

### 6.1 页面对应

| Web 页面 | iOS 页面 | 实现方式 |
|----------|---------|---------|
| `/map` | MapView | MapKit + MKAnnotation |
| `/insights` | ProfileView | SwiftUI Charts |
| `/friends` | FriendsView | SwiftUI List |
| `/login` | AuthView | Supabase Auth UI |
| `/signup` | AuthView | 同上，Tab 切换 |
| AddMoodModal | AddMoodSheet | SwiftUI Sheet |
| MoodDetailModal | MoodDetailSheet | SwiftUI Sheet |
| ClusterDetailPanel | ClusterListSheet | SwiftUI Sheet |

### 6.2 功能对应

| Web 功能 | iOS 实现 | 备注 |
|----------|---------|------|
| Leaflet 地图 | **MapKit** | 原生 3D 支持 |
| CSS emoji 动画 | **Core Animation** | 更流畅 |
| 浏览器 GPS | **CoreLocation** | 后台定位+地理围栏 |
| 30s 轮询通知 | **Supabase Realtime** (WebSocket) | 实时，省电 |
| FriendMoodBanner | **UNNotification** + 应用内 Banner | 支持锁屏推送 |
| MemoryReminder (轮询) | **CoreLocation 地理围栏** | 系统级，App 被杀也能触发 |
| compress-image.ts | **UIImage.jpegData(compressionQuality:)** | 原生压缩 |
| emotion-color.ts | **Swift Color 插值** | 同样的 5 色渐变 |
| ReactionBar | **SwiftUI HStack + emoji picker** | 无并发问题（独立表） |
| 10 分钟编辑 | **同样逻辑** | `createdAt.timeIntervalSinceNow > -600` |
| 全局搜索 | **SwiftData @Query + 谓词** | 本地搜索秒出结果 |
| Mood Trend 图表 | **Swift Charts** | Apple 原生图表框架 |

---

## 七、Xcode 项目结构

```
MoodBubble/
├── MoodBubbleApp.swift              # App 入口
├── ContentView.swift                # Tab 导航 (Map / Profile)
│
├── Models/
│   ├── LocalMoodEntry.swift         # SwiftData 本地 mood
│   ├── FriendMoodEntry.swift        # 缓存的朋友 mood
│   └── EmotionSystem.swift          # 颜色/emoji 映射 (从 TS 移植)
│
├── Views/
│   ├── Map/
│   │   ├── MapView.swift            # MapKit 主地图
│   │   ├── MoodAnnotation.swift     # 气泡标注 (emoji 动画)
│   │   ├── ClusterAnnotation.swift  # 聚合气泡
│   │   └── MoodDetailSheet.swift    # 详情底部弹窗
│   ├── AddMood/
│   │   ├── AddMoodSheet.swift       # 新建 mood 表单
│   │   ├── EmotionSlider.swift      # 0-100 渐变滑块
│   │   ├── CategoryPicker.swift     # 分类选择
│   │   └── LocationPicker.swift     # 位置选择
│   ├── Profile/
│   │   ├── ProfileView.swift        # 个人资料 + 统计
│   │   ├── MoodTrendChart.swift     # Swift Charts 趋势图
│   │   └── EditProfileSheet.swift   # 编辑头像/名字
│   ├── Friends/
│   │   ├── FriendsView.swift        # 好友列表 + 请求
│   │   ├── FriendCard.swift         # 好友卡片
│   │   └── UserSearchView.swift     # 搜索用户
│   ├── Auth/
│   │   ├── AuthView.swift           # 登录/注册
│   │   └── SplashView.swift         # 启动画面 (Logo + GPS)
│   └── Shared/
│       ├── UserAvatar.swift         # 头像组件
│       ├── ReactionBar.swift        # emoji 反应栏
│       └── MemoryBanner.swift       # 记忆提醒横幅
│
├── Services/
│   ├── SupabaseManager.swift        # Supabase 客户端单例
│   ├── AuthService.swift            # 登录/注册/登出
│   ├── MoodSyncService.swift        # 本地↔云端同步
│   ├── FriendService.swift          # 好友关系管理
│   ├── ReactionService.swift        # Reaction CRUD (独立表)
│   ├── LocationService.swift        # GPS + 地理围栏
│   ├── NotificationService.swift    # 推送通知管理
│   └── ImageService.swift           # 图片压缩 + 上传
│
├── Utilities/
│   ├── EmotionColor.swift           # 5 色 Morandi 渐变
│   ├── EmotionEmoji.swift           # 分数→emoji
│   ├── Haversine.swift              # 距离计算
│   └── TimeFormatting.swift         # 时间格式化
│
├── MoodBubbleWatch/                 # Apple Watch 目标
│   ├── WatchApp.swift
│   ├── QuickMoodView.swift          # 快速记录
│   └── WatchConnectivityManager.swift
│
├── Assets.xcassets/
│   ├── MoodBubbleLogo.png
│   └── AppIcon.appiconset/
│
└── Info.plist                       # 权限声明
```

---

## 八、需要的权限 (Info.plist)

```xml
NSLocationWhenInUseUsageDescription  — 在地图上显示你的位置并记录 mood 地点
NSLocationAlwaysUsageDescription     — 当你经过曾记录 mood 的地方时提醒你
NSCameraUsageDescription             — 为 mood 拍摄照片
NSPhotoLibraryUsageDescription       — 从相册选择 mood 照片
```

---

## 九、开发优先级路线图

### Phase 1：核心骨架（第 1-2 天）
- [ ] Xcode 项目创建 + SwiftData 模型
- [ ] Supabase Swift SDK 配置
- [ ] Auth 登录/注册页面
- [ ] Splash Screen (Logo + GPS 等待)

### Phase 2：地图 + 本地 Mood（第 3-4 天）
- [ ] MapKit 地图 + 用户定位蓝点
- [ ] 创建 Mood 表单 (slider + 分类 + 拍照 + 笔记)
- [ ] 本地存储 Private mood (SwiftData)
- [ ] 地图气泡标注 (颜色 + emoji 动画)
- [ ] 点击气泡 → 详情 Sheet

### Phase 3：云端同步 + 社交（第 5-6 天）
- [ ] Friends mood 上传到 Supabase
- [ ] 拉取朋友 mood 显示在地图
- [ ] Supabase Realtime 订阅 (替代轮询)
- [ ] 好友系统 (添加/接受/拒绝)
- [ ] Reaction 独立表 (点击 emoji)

### Phase 4：通知 + 提醒（第 7 天）
- [ ] CoreLocation 地理围栏 (位置记忆提醒)
- [ ] 时间周年提醒
- [ ] APNs 推送通知 (朋友发 mood)

### Phase 5：Profile + 完善（第 8 天）
- [ ] Profile 页面 + Swift Charts 趋势图
- [ ] 编辑/删除 mood + 可见性切换
- [ ] 全局搜索
- [ ] Apple Watch 快速记录

---

## 十、需要从 Web 版移植的核心算法

### 10.1 颜色系统 (emotion-color.ts → EmotionColor.swift)

```
5 个色值点 RGB 线性插值:
  0:   (148, 163, 184)  Morandi Blue
  25:  (134, 207, 172)  Mint Green
  50:  (232, 200, 122)  Warm Apricot
  75:  (232, 168, 122)  Soft Coral
  100: (212, 132, 154)  Rose Pink
```

### 10.2 Emoji 映射 (emotion-emoji.ts → EmotionEmoji.swift)

```
0-10:  💩    11-25: 😢    26-45: 😐    46-55: 🙂
56-75: 😊    76-90: 😄    91-100: 🌈
```

### 10.3 距离计算 (proximity.ts → Haversine.swift)

```
Haversine 公式，输入两个经纬度，输出米数
触发半径: 100 米
```

### 10.4 气泡大小

```
score 0-39:  小 (40pt)
score 40-69: 中 (56pt)
score 70-100: 大 (72pt)
```

---

## 十一、Supabase 配置清单

开发前需要确认/操作：

- [ ] Supabase 项目 URL 和 anon key 准备好
- [ ] 执行 SQL：创建 `mood_reactions` 独立表
- [ ] 执行 SQL：`ALTER TABLE mood_entries DROP COLUMN IF EXISTS reactions`
- [ ] 开启 Realtime：mood_entries 表
- [ ] Storage bucket `mood-media` 已存在且 public
- [ ] Storage RLS 策略已配置（authenticated 可上传，public 可读）
- [ ] 确认 Auth 邮箱登录可用

---

## 十二、Web 版当前状态参考

### 现有 API 端点（可在 iOS 开发时对照逻辑）

| 端点 | 文件 | iOS 对应 |
|------|------|---------|
| GET/POST /api/moods | `src/app/api/moods/route.ts` | MoodSyncService |
| PATCH/DELETE /api/moods/:id | `src/app/api/moods/[id]/route.ts` | MoodSyncService |
| GET /api/insights | `src/app/api/insights/route.ts` | 本地 SwiftData 计算 |
| PATCH /api/profile | `src/app/api/profile/route.ts` | AuthService |
| GET/POST /api/friends | `src/app/api/friends/route.ts` | FriendService |
| PATCH/DELETE /api/friends/:id | `src/app/api/friends/[id]/route.ts` | FriendService |
| GET /api/friends/requests | `src/app/api/friends/requests/route.ts` | FriendService |
| GET /api/users/search | `src/app/api/users/search/route.ts` | FriendService |

### 现有工具函数（需移植到 Swift）

| TypeScript 文件 | 功能 | Swift 文件 |
|----------------|------|-----------|
| `emotion-color.ts` | 5 色渐变 | EmotionColor.swift |
| `emotion-emoji.ts` | 分数→emoji | EmotionEmoji.swift |
| `proximity.ts` | Haversine 距离 | Haversine.swift |
| `compress-image.ts` | 图片压缩 | ImageService.swift |
| `categories.ts` | 分类元数据 | EmotionCategory.swift |
| `geolocation.ts` | GPS 封装 | LocationService.swift |
| `geocoding.ts` | 反向地理编码 | CLGeocoder (系统API) |

### 现有数据库表

| 表 | 字段 | iOS 变化 |
|---|------|---------|
| mood_entries | id, user_id, lat, lng, emotion_score(0-100), category, note, media_url, visibility, reactions(jsonb), created_at | 删除 reactions 列 |
| profiles | id, display_name, avatar_url, created_at, updated_at | 不变 |
| friendships | id, requester_id, addressee_id, status, created_at, updated_at | 不变 |
| mood_reactions | (新建) id, mood_id, user_id, emoji, created_at | 新增 |

---

## 十三、关键技术决策总结

| 决策 | 选择 | 原因 |
|------|------|------|
| 本地数据库 | SwiftData | Apple 原生，和 SwiftUI 深度集成 |
| 云端 | Supabase | 已有基础设施，Swift SDK 官方维护 |
| 地图 | MapKit | 原生 Apple 风格，免费，3D 支持 |
| 图表 | Swift Charts | Apple 原生，风格统一 |
| Reaction 存储 | 独立表 | 解决 JSONB 并发问题 |
| Private mood | 纯本地 | 省云端资源，保护隐私 |
| 朋友通知 | Realtime + APNs | 替代轮询，省电实时 |
| 位置提醒 | CoreLocation 地理围栏 | 系统级触发，App 杀掉也能工作 |
| Watch | WatchConnectivity | 通过 iPhone 中转，Watch 省电 |
