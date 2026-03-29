import SwiftUI

@main
struct RefrainApp: App {
    @State private var appState = AppState()

    init() {
        Theme.configureAppearance()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
        }
    }
}
