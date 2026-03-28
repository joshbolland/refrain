import SwiftUI
import Foundation

extension AppState {
    static func preview(loggedIn: Bool = true, populated: Bool = true) -> AppState {
        let state = AppState()
        state.isLoading = false

        if loggedIn {
            state.currentUser = User(
                id: "preview-user",
                email: "demo@refrain.app",
                displayName: "Demo User",
                avatarUrl: nil,
                createdAt: Date()
            )

            if populated {
                let now = Date()

                state.lyricFiles = [
                    LyricFile(
                        id: "lyric-1",
                        title: "First Song",
                        body: "First verse line\nSecond line\n\nChorus begins",
                        createdAt: now.addingTimeInterval(-86400 * 4),
                        updatedAt: now.addingTimeInterval(-3600),
                        sectionTypes: [:]
                    ),
                    LyricFile(
                        id: "lyric-2",
                        title: "Midnight Drive",
                        body: "Rolling past the city lights\nFading into night",
                        createdAt: now.addingTimeInterval(-86400 * 7),
                        updatedAt: now.addingTimeInterval(-7200),
                        sectionTypes: [:]
                    )
                ]

                state.recordings = [
                    Recording(
                        id: "rec-1",
                        title: "Chorus idea",
                        createdAt: now.addingTimeInterval(-86400 * 2),
                        updatedAt: now.addingTimeInterval(-1800),
                        durationMs: 42_000,
                        uri: "file:///tmp/chorus.m4a"
                    ),
                    Recording(
                        id: "rec-2",
                        title: "Verse riff",
                        createdAt: now.addingTimeInterval(-86400 * 1),
                        updatedAt: now.addingTimeInterval(-1600),
                        durationMs: 21_000,
                        uri: "file:///tmp/verse.m4a"
                    )
                ]

                state.collections = [
                    Collection(title: "Favorites"),
                    Collection(title: "Album Drafts")
                ]
            }
        } else {
            state.currentUser = nil
        }

        return state
    }
}

private struct IsPreviewKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var isPreview: Bool {
        get { self[IsPreviewKey.self] }
        set { self[IsPreviewKey.self] = newValue }
    }
}
