//
//  GameViewController.swift
//  Fantasy Kritter
//
//  Hosts the game in a WKWebView served straight out of the app bundle — no
//  network, no server, no localhost. The whole game is one HTML file in web/.
//

import UIKit
import WebKit

/// The origin the game is served from. It is a custom scheme rather than
/// `file://` on purpose: WKWebView gives file URLs an opaque origin, and
/// `localStorage` on an opaque origin is unreliable — it can silently do
/// nothing, or be discarded between launches. The game stores every run in
/// `localStorage` and swallows write failures by design, so that combination
/// would look exactly like "the app never saves my progress" with nothing in
/// the logs. A custom scheme gets a normal, stable origin tuple, which is the
/// same reason Capacitor and Ionic serve their apps this way.
private enum GameOrigin {
    static let scheme = "kritter"
    static let start = URL(string: "kritter://game/index.html")!
}

final class GameViewController: UIViewController, WKNavigationDelegate {

    private var webView: WKWebView!
    private var schemeHandler: BundleSchemeHandler?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.078, green: 0.062, blue: 0.141, alpha: 1) // #141024

        guard let webRoot = Bundle.main.url(forResource: "web", withExtension: nil) else {
            showBundleError()
            return
        }

        let config = WKWebViewConfiguration()
        // The game has no video or audio elements; sound is synthesised through
        // WebAudio, which needs to start from a user gesture either way.
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let handler = BundleSchemeHandler(root: webRoot)
        config.setURLSchemeHandler(handler, forURLScheme: GameOrigin.scheme)
        schemeHandler = handler

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false          // the game manages its own layout
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif

        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        // Pinned to the view, not the safe area: the page asks for
        // viewport-fit=cover and insets itself with env(safe-area-inset-*), so
        // the background reaches the edges while the buttons stay clear of the
        // notch and the home indicator.
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        webView.load(URLRequest(url: GameOrigin.start))
    }

    /// A blank screen is the hardest kind of failure to diagnose, so say what is
    /// actually wrong instead of showing one.
    private func showBundleError() {
        let label = UILabel()
        label.numberOfLines = 0
        label.textAlignment = .center
        label.textColor = .white
        label.font = .systemFont(ofSize: 15)
        label.text = """
        Spillet blev ikke fundet i app-bundtet.

        Kør `node tools/app.js` i projektmappen, og
        kontrollér at mappen 'web' ligger under
        Target ▸ Build Phases ▸ Copy Bundle Resources
        som en mappereference (blå mappe).
        """
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            label.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.85),
        ])
    }

    // The page never links out; if a future build does, hand it to Safari
    // rather than replacing the game inside its own window.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.scheme == GameOrigin.scheme {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    // Portrait only: the layout is designed for a phone held upright.
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
}

/// Serves the contents of the bundled `web` folder over the custom scheme.
/// Everything is read from the app bundle, so there is no network path here at
/// all — this is a filesystem read wearing an HTTP response.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {

    private let root: URL

    init(root: URL) {
        // Resolved once so the containment check below compares like with like.
        self.root = root.standardizedFileURL.resolvingSymlinksInPath()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        var relative = url.path
        if relative.isEmpty || relative == "/" { relative = "/index.html" }

        let file = root.appendingPathComponent(relative)
            .standardizedFileURL
            .resolvingSymlinksInPath()

        // `..` in a request must not be able to read the rest of the bundle.
        let inside = file.path == root.path || file.path.hasPrefix(root.path + "/")

        guard inside, let data = try? Data(contentsOf: file) else {
            respond(to: urlSchemeTask, url: url, status: 404,
                    mime: "text/plain; charset=utf-8",
                    data: Data("Ikke fundet: \(relative)".utf8))
            return
        }

        respond(to: urlSchemeTask, url: url, status: 200,
                mime: BundleSchemeHandler.mime(for: file.pathExtension),
                data: data)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func respond(to task: WKURLSchemeTask, url: URL, status: Int, mime: String, data: Data) {
        let response = HTTPURLResponse(
            url: url,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mime,
                "Content-Length": String(data.count),
                // The bundle is immutable, but a stale cache after an app
                // update is a confusing bug for a zero-cost read.
                "Cache-Control": "no-store",
            ]
        )!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    private static func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs":   return "text/javascript; charset=utf-8"
        case "css":         return "text/css; charset=utf-8"
        case "json":        return "application/json; charset=utf-8"
        case "svg":         return "image/svg+xml"
        case "png":         return "image/png"
        case "webp":        return "image/webp"
        case "woff2":       return "font/woff2"
        default:            return "application/octet-stream"
        }
    }
}
