import SwiftUI

enum MainTab: Hashable {
    case library
    case collections
}

struct MainTabView: View {
    @Environment(AppState.self) private var appState

    @State private var selectedTab: MainTab = .library
    @State private var showCreateSheet = false
    @State private var newLyric: LyricFile?
    @State private var showRecording = false

    var body: some View {
        TabView(selection: $selectedTab) {
            LibraryView()
                .tag(MainTab.library)

            CollectionsView()
                .tag(MainTab.collections)
        }
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom) {
            if !appState.isTabBarHidden && !showRecording {
                PrimaryTabBar(
                    selectedTab: $selectedTab,
                    onCreate: { showCreateSheet = true }
                )
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .sheet(isPresented: $showCreateSheet) {
            CreateActionSheet(
                onCreateLyric: {
                    showCreateSheet = false
                    Task { await createLyric() }
                },
                onCreateRecording: {
                    showCreateSheet = false
                    showRecording = true
                }
            )
            .presentationDetents([.height(260)])
        }
        .sheet(item: $newLyric) { file in
            NavigationStack {
                LyricEditorView(file: file)
            }
        }
        .sheet(isPresented: $showRecording) {
            RecordingView()
        }
    }

    private func createLyric() async {
        if let file = await appState.createLyricFile() {
            newLyric = file
        }
    }
}

struct PrimaryTabBar: View {
    @Binding var selectedTab: MainTab
    let onCreate: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Theme.divider)
                .frame(height: 1)

            HStack(spacing: 0) {
                TabItem(
                    title: "Library",
                    systemImage: "book.closed",
                    selectedSystemImage: "book.closed.fill",
                    isSelected: selectedTab == .library
                ) {
                    selectedTab = .library
                }
                .frame(maxWidth: .infinity)

                Button(action: onCreate) {
                    ZStack {
                        Circle()
                            .fill(Theme.accent)
                            .frame(width: 56, height: 56)
                            .overlay(
                                Circle()
                                    .stroke(Theme.accentPressed, lineWidth: 1)
                            )

                        Image(systemName: "plus")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .buttonStyle(PressableScaleStyle())
                .shadow(color: Color.black.opacity(0.14), radius: 14, x: 0, y: 8)
                .padding(.horizontal, 8)
                .frame(maxWidth: .infinity)

                TabItem(
                    title: "Collections",
                    systemImage: "square.grid.2x2",
                    selectedSystemImage: "square.grid.2x2.fill",
                    isSelected: selectedTab == .collections
                ) {
                    selectedTab = .collections
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 12)
            .background(Theme.paper)
        }
        .frame(maxWidth: .infinity)
    }
}

struct TabItem: View {
    let title: String
    let systemImage: String
    let selectedSystemImage: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        let iconName = isSelected ? selectedSystemImage : systemImage
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: iconName)
                    .font(.system(size: 24, weight: .medium))

                Text(title)
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(isSelected ? Theme.accentPressed : Color(hex: "6B7280"))
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .buttonStyle(PressableScaleStyle())
    }
}

struct CreateActionSheet: View {
    let onCreateLyric: () -> Void
    let onCreateRecording: () -> Void

    private let columns = [
        GridItem(.flexible(), spacing: 18),
        GridItem(.flexible(), spacing: 18)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 18) {
            CreateActionCard(
                title: "New Lyric",
                subtitle: "Draft a fresh refrain.",
                systemImage: "music.note",
                background: Color(hex: "F4F6FF"),
                border: Color(hex: "D5DAF1"),
                action: onCreateLyric
            )

            CreateActionCard(
                title: "New Recording",
                subtitle: "Capture a quick idea.",
                systemImage: "mic",
                background: Theme.paper,
                border: Color(hex: "DDE2F0"),
                action: onCreateRecording
            )
        }
        .padding(24)
    }
}

struct CreateActionCard: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let background: Color
    let border: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Theme.accentPressed.opacity(0.12))
                        .frame(width: 48, height: 48)

                    Image(systemName: systemImage)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(Theme.accentPressed)
                }

                VStack(spacing: 4) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)

                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted.opacity(0.8))
                }
            }
            .frame(maxWidth: .infinity, minHeight: 140)
            .padding(16)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(PressableScaleStyle())
    }
}

#Preview("Library Tab") {
    MainTabView()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}

#Preview("Collections Tab") {
    var state = AppState.preview()
    return MainTabView()
        .environment(state)
        .environment(\.isPreview, true)
}
