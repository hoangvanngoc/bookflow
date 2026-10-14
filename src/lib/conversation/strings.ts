import { fromISODate } from "../time";

export type Locale = "vi" | "en";

const VI_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** "T7 17/10" in Vietnamese, "Sat 17 Oct" in English. */
export function dayLabel(iso: string, locale: Locale): string {
  const d = fromISODate(iso);
  if (locale === "vi") return `${VI_WEEKDAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Every sentence the chat engine can say. One sentence per key, variables interpolated whole. */
export const strings = {
  vi: {
    askService: "Chào anh/chị, mình muốn đặt dịch vụ nào ạ?",
    askTime: (service: string, day: string) => `${service} ngày ${day}. Anh/chị muốn mấy giờ ạ?`,
    timeTaken: (time: string, day: string) => `${time} ngày ${day} đã kín. Các giờ gần nhất còn trống:`,
    noTimes: (day: string) => `Ngày ${day} đã hết chỗ. Anh/chị chọn ngày khác giúp mình nhé.`,
    closed: (day: string) => `Ngày ${day} tiệm nghỉ. Các ngày còn chỗ:`,
    full: (day: string) => `Ngày ${day} đã kín lịch. Các ngày còn chỗ:`,
    noDays: "Hai tuần tới đã kín lịch, anh/chị vui lòng liên hệ tiệm trực tiếp ạ.",
    askContact: (service: string, day: string, time: string) =>
      `${service} lúc ${time} ngày ${day} còn trống. Anh/chị gửi giúp mình tên và số điện thoại để giữ chỗ nhé.`,
    needPhone: "Mình chưa thấy số điện thoại. Anh/chị gửi lại tên và số điện thoại giúp mình nhé.",
    confirmed: (name: string, service: string, day: string, time: string) =>
      `Đã đặt xong cho ${name}: ${service} lúc ${time} ngày ${day}. Hẹn gặp anh/chị!`,
    replyWithNumber: "Trả lời bằng số thứ tự để chọn.",
    reset: "Đã hủy. Anh/chị cần đặt lịch gì cứ nhắn mình nhé.",
    defaultName: "Khách Zalo",
  },
  en: {
    askService: "Hi! Which service would you like to book?",
    askTime: (service: string, day: string) => `${service} on ${day}. What time suits you?`,
    timeTaken: (time: string, day: string) => `${time} on ${day} is taken. Closest free times:`,
    noTimes: (day: string) => `${day} is fully booked. Please pick another day.`,
    closed: (day: string) => `We're closed on ${day}. Days with room:`,
    full: (day: string) => `${day} is fully booked. Days with room:`,
    noDays: "The next two weeks are full. Please contact the shop directly.",
    askContact: (service: string, day: string, time: string) =>
      `${service} at ${time} on ${day} is free. Send your name and phone number to hold it.`,
    needPhone: "I couldn't find a phone number. Please send your name and phone number.",
    confirmed: (name: string, service: string, day: string, time: string) =>
      `Booked for ${name}: ${service} at ${time} on ${day}. See you then!`,
    replyWithNumber: "Reply with a number to choose.",
    reset: "Cancelled. Message me whenever you want to book.",
    defaultName: "Zalo customer",
  },
} as const;
