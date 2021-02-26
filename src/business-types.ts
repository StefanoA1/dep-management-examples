export type UserId = string;
type UserName = string;
type EmailAddress = string;
export type Profile = {
  userId: UserId;
  name: UserName;
  emailAddress: EmailAddress;
};
export type EmailMessage = {
  To: EmailAddress;
  Body: string;
};
