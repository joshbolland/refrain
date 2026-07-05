import SwiftUI
import Foundation

extension AppState {
    static func preview(loggedIn: Bool = true, populated: Bool = true) -> AppState {
        let state = AppState()
        state.isLoading = false

        if loggedIn {
            let favoritesProject = Project(
                id: "collection-favorites",
                title: "Favorites",
                description: "Best ideas worth keeping close"
            )
            let albumDraftsProject = Project(
                id: "collection-album-drafts",
                title: "Album Drafts",
                description: "Work in progress for the next release"
            )

            let firstSong = LyricFile(
                id: "lyric-1",
                title: "First Song",
                body: "First verse line\nSecond line\n\nChorus begins",
                createdAt: Date().addingTimeInterval(-86400 * 4),
                updatedAt: Date().addingTimeInterval(-3600),
                sectionTypes: [
                    0: .verse,
                    3: .chorus
                ]
            )
            let midnightDrive = LyricFile(
                id: "lyric-2",
                title: "Midnight Drive",
                body: "Rolling past the city lights\nFading into night",
                createdAt: Date().addingTimeInterval(-86400 * 7),
                updatedAt: Date().addingTimeInterval(-7200),
                sectionTypes: [
                    0: .verse
                ]
            )

            let chorusIdea = Recording(
                id: "rec-1",
                title: "Chorus idea",
                createdAt: Date().addingTimeInterval(-86400 * 2),
                updatedAt: Date().addingTimeInterval(-1800),
                durationMs: 42_000,
                uri: "file:///tmp/chorus.m4a"
            )
            let verseRiff = Recording(
                id: "rec-2",
                title: "Verse riff",
                createdAt: Date().addingTimeInterval(-86400 * 1),
                updatedAt: Date().addingTimeInterval(-1600),
                durationMs: 21_000,
                uri: "file:///tmp/verse.m4a"
            )

            state.currentUser = User(
                id: "preview-user",
                email: "demo@refrain.app",
                displayName: "Demo User",
                avatarUrl: nil,
                createdAt: Date()
            )

            if populated {
                state.lyricFiles = [
                    firstSong,
                    midnightDrive
                ]

                state.recordings = [
                    chorusIdea,
                    verseRiff
                ]

                state.projects = [
                    favoritesProject,
                    albumDraftsProject
                ]

                state.projectAssignments = [
                    ProjectAssignment(
                        projectId: favoritesProject.id,
                        itemId: firstSong.id,
                        itemType: .lyric
                    ),
                    ProjectAssignment(
                        projectId: favoritesProject.id,
                        itemId: chorusIdea.id,
                        itemType: .recording
                    ),
                    ProjectAssignment(
                        projectId: albumDraftsProject.id,
                        itemId: midnightDrive.id,
                        itemType: .lyric
                    )
                ]

                state.itemMetadataById = [
                    firstSong.id: LibraryItemMetadata(isFavorite: true, isArchived: false),
                    chorusIdea.id: LibraryItemMetadata(isFavorite: true, isArchived: false),
                    verseRiff.id: LibraryItemMetadata(isFavorite: false, isArchived: true)
                ]
            }
        } else {
            state.currentUser = nil
        }

        return state
    }

    static func previewProject(id: String = "collection-favorites") -> Project {
        preview().projects.first(where: { $0.id == id }) ?? Project(id: id)
    }

    static func previewLyric(id: String = "lyric-1") -> LyricFile {
        preview().lyricFiles.first(where: { $0.id == id }) ?? LyricFile(id: id)
    }

    static func previewRecording(id: String = "rec-1") -> Recording {
        preview().recordings.first(where: { $0.id == id }) ?? Recording(id: id)
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
