/* F1.9r 홈 화면 앱(PWA)용 서비스 워커
 *  - 화면 파일을 저장(캐시)하지 않음 → GitHub에 올리면 앱에도 바로 반영 (예전 화면이 남지 않게)
 *  - 홈 화면에 추가할 수 있게 하는 최소 조건만 채움 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* 그대로 인터넷에서 받음 (저장 안 함) */ });
