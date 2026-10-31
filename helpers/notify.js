const Notify = ({ title, body }) =>
  new Notification(title, {
    body,
  });

export { Notify };
