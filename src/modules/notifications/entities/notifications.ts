import { Notification } from "@prisma/client";


class NotificationEntity {
  id!: Notification["id"];
  // userId!: Notification[""];
  investmentId!: Notification["investmentId"];
  title!: Notification["title"];
  message!: Notification["message"];
  isRead!: Notification["isRead"];
  createdAt!: Notification["createdAt"];
}

export { NotificationEntity };