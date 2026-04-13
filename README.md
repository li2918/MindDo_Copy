# MindDo

## 项目说明

MindDo 当前原型页面已经覆盖了业务主链路中的核心触点，包括首页总览、试课报名、注册报名、课程体系、选课排课、学生账户、学习反馈、运营看板与学期报告。基于这些页面，推荐将整个业务设计为一条“系统默认自动推进，人工只处理异常和高价值节点”的自动化流程。

## 推荐业务流程

### 1. 获客与线索进入

用户从官网、广告、社媒或转介绍进入 `index.html`、`trial.html` 或 `signup.html` 后，系统自动创建 Lead，并写入来源、年级、兴趣方向、目标课程、触达时间等字段。系统同步完成标签分类、去重、基础评分和自动分流，不需要顾问手动录入。

### 2. 自助试课与自动跟进

用户在 `trial.html` 自助预约试课时间，系统自动完成确认通知、上课提醒、试课资料发送和课后回访问卷。试课结束后，系统根据出勤、互动、问卷反馈和老师记录自动生成评估结果，并将高意向用户推送到 `assessment.html` 和 `signup.html` 对应的转化链路。只有当系统识别为高意向、高客单或存在疑问时，销售或顾问才介入。

### 3. 自动报名与支付门槛

家长在 `signup.html` 完成账户注册、套餐选择和首月支付。业务规则建议设为“先支付，后排课”：只有首单支付成功，系统才把学生状态从 Lead / Trial 转为 Active Student，并激活 membership。这样可以最大限度避免人工催款、先排课后收款和后续状态混乱。

### 4. 自动排课与交付准备

支付完成后，系统把学生放入 Ready Pool，并在 `course-selection.html` 提供可选课程和时间段。家长自助选择上课时间后，系统自动锁定时段、匹配可用老师、写入课表，并通知老师确认。如果老师在规定时间内未确认，系统自动提醒；若仍未响应，则自动重新分配，人工只处理系统无法完成的冲突。

### 5. 在读阶段自动化运营

学生进入正式学习后，`student-account.html`、`feedback.html`、`dashboard.html` 和 `semester-report.html` 对应的能力应统一连接到同一份学习数据底座。系统自动记录出勤、课消、作业完成度、课堂表现和阶段进度；在第 2 节课、课程进度过半、临近结课等节点自动触发满意度调查、阶段反馈和学期报告。班主任或老师只在风险预警出现时介入，例如连续缺课、作业连续未完成或满意度下降。

### 6. 自动续费、续课与召回

当系统检测到剩余课时低于阈值时，自动生成下一阶段课程推荐、续课理由和套餐建议，并通过站内消息、邮件或微信模板消息进行多轮提醒。若家长确认，系统自动续费并延续后续排课资格；若在设定时间内未响应，则自动进入 Win-back Pool，持续推送活动、公开课和新课程内容，尽量把召回流程自动化。

## 人工介入原则

整套流程里，人工建议只保留在四类节点：

1. 高意向或高客单用户，需要人工提升成交率。
2. 支付异常、排课冲突、老师不可用等系统异常。
3. 学习风险预警，例如连续缺勤、低满意度或退费风险。
4. 重要续费节点中系统多次触达无响应的用户。

除以上场景外，默认都由系统完成触达、判断、记录、提醒和状态流转。

## 建议的数据与系统规则

为了实现接近全自动化，建议统一维护以下核心状态字段：

- `lead_status`
- `trial_status`
- `assessment_result`
- `payment_completed`
- `membership_active`
- `ready_pool_status`
- `teacher_confirmation_status`
- `attendance_rate`
- `homework_completion_rate`
- `remaining_sessions`
- `renewal_status`
- `winback_status`

核心业务规则建议固定为：

- 未支付首单，不允许进入正式排课。
- membership 未激活，不允许继续锁定课时。
- 老师超时未确认，自动提醒并重分配。
- 关键运营节点由系统自动触发，不依赖人工记忆。
- 所有触达、支付、排课、上课、反馈和续费动作都应回写到统一 CRM / 教务数据层。

## 系统架构建议

建议把 MindDo 拆成 6 个相互协作的业务模块，由一个统一的数据层和自动化规则引擎驱动：

### 1. 流量与线索模块

负责承接官网、广告、社媒、转介绍等入口流量，对应 `index.html`、`trial.html`、`signup.html`。该模块负责创建 Lead、识别来源、去重、打标签、计算初始意向分，并把用户送入试课或直接报名流程。

### 2. 评估与转化模块

负责试课预约、试课结果沉淀、自动评估与转化推进，对应 `trial.html`、`assessment.html`、`signup.html`。该模块输出的核心结果是：这个用户是否适合继续报名、推荐什么课程、是否需要人工跟进。

### 3. 支付与 membership 模块

负责套餐、支付、自动扣费、续费授权和账单状态管理。它是排课系统的前置门禁，只有支付和 membership 状态满足条件，才能继续进入正式排课和续课。

### 4. 排课与教务模块

负责课程可售卖时间、老师可用时间、家长自助锁课、老师确认、自动重分配和课表生成，对应 `course-selection.html`、`course-system.html`。这是最关键的自动执行模块之一，目标是让人工教务只处理冲突，不处理常规排课。

### 5. 在读运营模块

负责学生学习档案、课堂记录、课消、阶段反馈、家长视图和运营看板，对应 `student-account.html`、`feedback.html`、`dashboard.html`、`semester-report.html`。它持续接收课堂数据，并把行为变化转成自动提醒和风险标记。

### 6. 续费与召回模块

负责剩余课时监控、续课推荐、自动提醒、自动续费、沉默用户召回和 Win-back Pool 管理。它的目标是把续费动作前置、标准化，并尽量从“人工临时追单”变成“系统按规则推进”。

## 推荐技术流转

如果按可落地的系统方式来设计，推荐采用下面这条基础流转链路：

1. 前端页面负责收集用户输入和触发动作。
2. 后端业务服务负责写入主数据表并校验业务规则。
3. 自动化规则引擎根据事件触发状态流转。
4. 通知服务负责邮件、短信、微信或站内消息触达。
5. CRM / 教务主库负责沉淀用户、课程、支付、排课、上课和续费数据。
6. 看板服务从主库读取数据，生成 dashboard 和 report。

可以把核心实现理解为“事件驱动”：

- 用户提交试课表单，触发 `lead_created`
- 用户完成试课，触发 `trial_completed`
- 用户完成支付，触发 `payment_succeeded`
- 用户锁定时段，触发 `slot_reserved`
- 老师未在时限内确认，触发 `teacher_confirmation_timeout`
- 课程剩余课时过低，触发 `renewal_triggered`

只要事件和状态设计清楚，很多人工动作都可以被自动规则代替。

## 核心数据表建议

下面这组表足够支撑当前原型对应的主业务流程：

### 1. `leads`

保存最早进入系统的潜在用户数据。

- `id`
- `parent_name`
- `student_name`
- `contact_phone`
- `contact_wechat`
- `grade`
- `interest_track`
- `source_channel`
- `lead_score`
- `lead_status`
- `created_at`

### 2. `students`

保存已经完成报名或进入正式学习的学生主档案。

- `id`
- `lead_id`
- `student_name`
- `parent_id`
- `current_level`
- `current_course_id`
- `student_status`
- `risk_level`
- `join_date`

### 3. `trial_bookings`

保存试课预约和试课完成情况。

- `id`
- `lead_id`
- `trial_teacher_id`
- `trial_time`
- `trial_status`
- `attendance_status`
- `feedback_score`
- `assessment_result`
- `recommended_course_id`

### 4. `memberships`

保存会员关系、首月支付结果、续费状态和自动扣费授权。

- `id`
- `student_id`
- `plan_id`
- `membership_status`
- `first_payment_status`
- `auto_renew_enabled`
- `billing_cycle`
- `next_billing_date`
- `renewal_status`

### 5. `payments`

保存全部支付和扣费记录。

- `id`
- `student_id`
- `membership_id`
- `payment_type`
- `amount`
- `payment_status`
- `paid_at`
- `payment_channel`
- `failure_reason`

### 6. `courses`

保存课程产品、阶段、课包和售卖属性。

- `id`
- `course_name`
- `course_level`
- `course_type`
- `session_count`
- `price`
- `status`

### 7. `teacher_slots`

保存老师的可售卖时间和排班基础数据。

- `id`
- `teacher_id`
- `weekday`
- `start_time`
- `end_time`
- `slot_status`
- `capacity`

### 8. `enrollments`

保存学生与课程的正式关系。

- `id`
- `student_id`
- `course_id`
- `enrollment_status`
- `start_date`
- `scheduled_teacher_id`
- `remaining_sessions`

### 9. `class_sessions`

保存每一节课的交付记录。

- `id`
- `enrollment_id`
- `teacher_id`
- `scheduled_at`
- `session_status`
- `attendance_status`
- `homework_status`
- `progress_note`

### 10. `automation_tasks`

保存由系统自动生成的提醒、催办和规则任务。

- `id`
- `student_id`
- `task_type`
- `trigger_event`
- `task_status`
- `scheduled_at`
- `completed_at`

### 11. `communications`

保存系统和人工对家长的所有触达记录。

- `id`
- `student_id`
- `channel`
- `message_type`
- `send_status`
- `sent_at`
- `operator_type`

## 状态流转设计

为了做到“低人工”，最重要的不是页面多少，而是状态流转是否统一。推荐定义以下主状态机。

### 1. Lead 状态

`new` → `tagged` → `trial_booked` → `trial_completed` → `qualified` → `converted`

补充异常分支：

`new` → `invalid`

`trial_booked` → `no_show`

`trial_completed` → `nurturing`

### 2. Membership 状态

`pending_payment` → `active` → `renewal_due` → `renewed`

补充异常分支：

`pending_payment` → `payment_failed`

`active` → `paused`

`renewal_due` → `expired`

### 3. 排课状态

`ready_pool` → `slot_selected` → `teacher_pending_confirm` → `scheduled` → `in_progress` → `completed`

补充异常分支：

`teacher_pending_confirm` → `teacher_timeout`

`teacher_timeout` → `reassigned`

`scheduled` → `rescheduled`

### 4. 续费状态

`not_started` → `triggered` → `recommended` → `reminded` → `confirmed` → `paid`

补充异常分支：

`reminded` → `silent`

`silent` → `winback_pool`

### 5. 风险状态

`normal` → `attention` → `at_risk` → `manual_followup`

建议自动触发条件示例：

- 连续 2 次缺课，进入 `attention`
- 连续 3 次缺课或满意度过低，进入 `at_risk`
- 连续提醒后仍无改善，进入 `manual_followup`

## 自动化规则引擎建议

如果后续要实现，建议把规则写成明确的 “条件 + 动作” 结构，而不是分散在多个页面里：

### 规则示例

1. 当 `trial_status = completed` 且 `assessment_result = pass` 时，自动发送报名链接。
2. 当 `first_payment_status != paid` 时，禁止进入 `ready_pool`。
3. 当家长完成选时但 `teacher_confirmation_status = pending` 超过 24 小时，自动提醒老师。
4. 当老师提醒后仍未确认，自动释放当前老师并重新匹配候选老师。
5. 当 `remaining_sessions <= 4` 时，自动创建续费任务并生成推荐课程。
6. 当续费任务 7 天无响应时，自动改为 `winback_status = active`。

## 最小可实施版本

如果你后面准备真正开发，最建议先做 MVP 版本，而不是一次做全套系统。优先级可以是：

1. Lead / Trial / Signup / Payment 的主链路打通。
2. “先支付后排课”的硬规则落地。
3. 自助排课 + 老师超时确认自动提醒。
4. 在读阶段课消记录 + 剩余课时自动触发续费。
5. 基础 dashboard 和学期报告自动生成。

这 5 步完成后，MindDo 就已经具备一个非常像业务系统而不是展示原型的骨架了。

## 一句话总结

MindDo 的推荐业务流程不是把人完全拿掉，而是让系统承担绝大多数标准动作，把人工集中在转化提升、异常处理和关键关系维护上，从而把业务尽量推向可规模化、可复制的全自动运营模式。
