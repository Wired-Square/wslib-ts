/** A `/ws/serial` socket the test drives. */
export class FakeSocket {
  binaryType = "blob";
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  sent: Uint8Array[] = [];
  close() {
    this.closed = true;
  }
  send(bytes: Uint8Array) {
    this.sent.push(bytes);
  }
  text(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
  binary(data: string) {
    this.onmessage?.({ data: new TextEncoder().encode(data).buffer });
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}
