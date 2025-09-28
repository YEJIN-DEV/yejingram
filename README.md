# Yejingram

웹 채팅 형식 LLM 대화 플랫폼, 예진그램입니다.

## Acknowledgment 고지사항

이 프로젝트는 [dkfk5326/ArisuTalk](https://github.com/dkfk5326/ArisuTalk)의 아이디어에 영감받아 구축하였습니다. 각종 기능은 원본을 기반으로 추가 및 수정되었습니다.

This project was built inspired by the idea from [dkfk5326/ArisuTalk](https://github.com/dkfk5326/ArisuTalk). Features have been added and modified based on the original.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/YEJIN-DEV/yejingram.git
   cd yejingram
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Contribution

버그 리포트, 기능 제안, Pull Request 등 모든 형태의 기여를 적극 환영합니다!

브랜치 생성 후 작업하시고, 변경 사항을 커밋한 뒤 Pull Request를 생성해 주세요.

## License

이 프로젝트는 GPL-3.0 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.

This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

## Dependencies

- [React](https://reactjs.org/)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [JSZip](https://stuk.github.io/jszip/)

## Sync Server (optional)

경량 Express 동기화 서버가 포함되어 있습니다. 저장/수정/삭제등의 상태 변화가 발생시 이를 원격 서버와 동기화 합니다.

서버 실행:

```
npm run server
```

기본 주소: http://hostname:3001

헬스 체크:

```
GET /api/health -> { ok: true }
```
