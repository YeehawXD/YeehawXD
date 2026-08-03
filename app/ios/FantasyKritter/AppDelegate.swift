//
//  AppDelegate.swift
//  Fantasy Kritter
//
//  Minimal UIKit entry point. Everything visual lives in the web bundle; this
//  side only owns the window and the app lifecycle.
//

import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = GameViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    /// The game runs on requestAnimationFrame, which the system already pauses
    /// in the background, so there is nothing to tear down here. Progress is
    /// written to localStorage on every change rather than on quit, so an
    /// abrupt termination never loses a run.
    func applicationWillTerminate(_ application: UIApplication) {}
}
