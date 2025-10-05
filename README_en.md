# Yejingram

Web-based chat-style LLM conversation platform, Yejingram.

[한국어](./README.md) / [English](./README_en.md) / [日本語](./README_ja.md)

---

## Acknowledgment

This project was built inspired by the idea from [dkfk5326/ArisuTalk](https://github.com/dkfk5326/ArisuTalk). Features have been added and modified based from the original.

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

We welcome all forms of contributions, including bug reports, feature suggestions, pull requests, translate suggestions, and more!

Please fork the repository, create a new branch, make your changes, commit them, and then open a pull request.

> Please send your PR to the `dev` branch.

## License

This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

## Sync Server (optional)

A lightweight Express sync server is included. It synchronizes state changes such as create/update/delete with a remote server.

To run the server:

    ```
    npm run server
    ```

Default address: http://hostname:3001

Health check:

    ```
    GET /api/health -> { ok: true }
    ```

---

If you have any feedback or suggestions for improvement, please feel free to submit an Issue or Pull Request.

Thank you!
