import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.isPreview) private var isPreview

    var body: some View {
        Group {
            if appState.isLoading {
                LoadingView()
            } else if appState.currentUser == nil {
                LoginView()
            } else {
                MainTabView()
            }
        }
        .task {
            if !isPreview {
                await appState.initialize()
            }
        }
        .dismissKeyboardOnTap()
        .onOpenURL { url in
            Task {
                await appState.handleOpenURL(url)
            }
        }
    }
}

struct LoadingView: View {
    var body: some View {
        ZStack {
            AuthBackground()

            Image("RefrainBird")
                .resizable()
                .scaledToFit()
                .frame(width: 240)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview("Splash") {
    LoadingView()
}

#Preview("Logged out") {
    ContentView()
        .environment(AppState.preview(loggedIn: false))
        .environment(\.isPreview, true)
}

#Preview("Library populated") {
    ContentView()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}

#Preview("Empty account") {
    let state = AppState.preview()
    state.lyricFiles = []
    state.recordings = []
    return ContentView()
        .environment(state)
        .environment(\.isPreview, true)
}
