import SwiftUI

struct LibraryView: View {
    @Environment(AppState.self) private var appState

    @State private var showFilterSheet = false
    @State private var showProfile = false
    @State private var selectedItem: LibraryItem?
    @State private var collectionSheetItem: LibraryItem?
    @State private var swipeOpenItemId: String?

    private var headerSubtitle: String {
        if !appState.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Showing results for \"\(appState.searchQuery)\""
        }
        let count = appState.filteredLibraryItems.count
        return "\(count) \(count == 1 ? "idea" : "ideas")"
    }

    private var hasActiveFilters: Bool {
        appState.selectedCollectionFilter != nil || appState.selectedItemTypeFilter != .all
    }

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                ZStack(alignment: .top) {
                    Theme.headerBackground
                        .ignoresSafeArea()

                    VStack(spacing: 0) {
                        headerView(topInset: proxy.safeAreaInsets.top)

                        ScrollView {
                            VStack(spacing: 16) {
                                SearchBar(text: Binding(
                                    get: { appState.searchQuery },
                                    set: { appState.searchQuery = $0 }
                                ), placeholder: "Search ideas")

                                if appState.filteredLibraryItems.isEmpty {
                                    emptyStateView
                                } else {
                                    listView
                                }
                            }
                            .padding(.top, 22)
                            .padding(.horizontal, 20)
                            .padding(.bottom, 120)
                            .frame(maxWidth: .infinity)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Theme.paper)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            closeOpenSwipeRow()
                        }
                        .clipShape(
                            RoundedCorner(
                                radius: Theme.cornerRadiusSmall,
                                corners: [.topLeft, .topRight]
                            )
                        )
                        .shadow(color: Color.black.opacity(0.06), radius: 12, x: 0, y: 6)
                        .ignoresSafeArea(edges: .bottom)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showFilterSheet) {
                LibraryFilterSheet()
            }
            .sheet(isPresented: $showProfile) {
                ProfileView()
            }
            .sheet(item: $collectionSheetItem) { item in
                CollectionsSheet(item: item)
            }
            .navigationDestination(item: $selectedItem) { item in
                switch item {
                case .lyric(let file):
                    LyricEditorView(file: file)
                case .recording(let recording):
                    PlaybackView(recording: recording)
                }
            }
            .onChange(of: appState.searchQuery) {
                swipeOpenItemId = nil
            }
        }
    }

    private func headerView(topInset: CGFloat) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Library")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                Text(headerSubtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted.opacity(0.8))
            }

            Spacer()

            HStack(spacing: 10) {
                Button {
                    showFilterSheet = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.ink)

                        if hasActiveFilters {
                            Circle()
                                .fill(Theme.accent)
                                .frame(width: 6, height: 6)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                }
                .buttonStyle(PressableScaleStyle())

                Button {
                    showProfile = true
                } label: {
                    UserAvatar(user: appState.currentUser)
                }
                .buttonStyle(PressableScaleStyle())
            }
        }
        .padding(.top, 6)
        .padding(.horizontal, 20)
        .padding(.bottom, 28)
    }

    private var emptyStateView: some View {
        VStack(spacing: 10) {
            Text("This is your first idea.")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Text("Every song starts somewhere.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted.opacity(0.9))

            Button {
                Task {
                    if let file = await appState.createLyricFile() {
                        selectedItem = .lyric(file)
                    }
                }
            } label: {
                Text("Create lyric")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(2)
                    .foregroundStyle(Theme.accentPressed)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(Color(hex: "E8EBFF"))
                    .overlay(
                        Capsule()
                            .stroke(Color(hex: "C7D1FF"), lineWidth: 1)
                    )
                    .clipShape(Capsule())
            }
            .buttonStyle(PressableScaleStyle())
            .padding(.top, 6)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 18)
        .background(Theme.accentSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private var listView: some View {
        let items = appState.filteredLibraryItems

        return LazyVStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                SwipeToDeleteRow(
                    id: item.id,
                    isOpen: swipeOpenItemId == item.id,
                    onOpenChange: { isOpen in
                        swipeOpenItemId = isOpen ? item.id : (swipeOpenItemId == item.id ? nil : swipeOpenItemId)
                    },
                    onDelete: {
                        swipeOpenItemId = nil
                        Task { await deleteItem(item) }
                    }
                ) {
                    LibraryItemRow(item: item, onSelect: {
                        if swipeOpenItemId == item.id {
                            withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
                                swipeOpenItemId = nil
                            }
                            return
                        }
                        selectedItem = item
                    }, showsPressFeedback: false)
                }
                .contextMenu {
                    contextMenuContent(for: item)
                }

                if index < items.count - 1 {
                    Divider()
                        .background(Theme.divider)
                }
            }
        }
    }

    @ViewBuilder
    private func contextMenuContent(for item: LibraryItem) -> some View {
        Button {
            selectedItem = item
        } label: {
            Label("Edit", systemImage: "pencil")
        }

        Button {
            collectionSheetItem = item
        } label: {
            Label("Add to Collection", systemImage: "folder.badge.plus")
        }

        Divider()

        Button(role: .destructive) {
            Task { await deleteItem(item) }
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }

    private func deleteItem(_ item: LibraryItem) async {
        switch item {
        case .lyric(let file):
            await appState.deleteLyricFile(file)
        case .recording(let recording):
            await appState.deleteRecording(recording)
        }
    }

    private func closeOpenSwipeRow() {
        guard swipeOpenItemId != nil else { return }
        withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
            swipeOpenItemId = nil
        }
    }
}

private struct SwipeToDeleteRow<Content: View>: View {
    let id: String
    let isOpen: Bool
    let onOpenChange: (Bool) -> Void
    let onDelete: () -> Void
    let content: Content

    @State private var settledOffset: CGFloat = 0
    @GestureState private var dragOffset: CGFloat = 0

    private let actionWidth: CGFloat = 96
    private let openThreshold: CGFloat = 52

    init(
        id: String,
        isOpen: Bool,
        onOpenChange: @escaping (Bool) -> Void,
        onDelete: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.id = id
        self.isOpen = isOpen
        self.onOpenChange = onOpenChange
        self.onDelete = onDelete
        self.content = content()
    }

    var body: some View {
        ZStack(alignment: .trailing) {
            deleteAction

            content
                .background(Theme.paper)
                .contentShape(Rectangle())
                .offset(x: currentOffset)
        }
        .onChange(of: isOpen) { _, open in
            withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
                settledOffset = open ? -actionWidth : 0
            }
        }
        .highPriorityGesture(dragGesture)
    }

    private var currentOffset: CGFloat {
        max(-actionWidth, min(0, settledOffset + dragOffset))
    }

    private var deleteAction: some View {
        Button(role: .destructive) {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.92)) {
                settledOffset = 0
            }
            onOpenChange(false)
            onDelete()
        } label: {
            VStack(spacing: 6) {
                Image(systemName: "trash")
                    .font(.system(size: 15, weight: .semibold))

                Text("Delete")
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(width: actionWidth)
            .frame(maxHeight: .infinity)
            .background(Theme.destructive)
        }
        .buttonStyle(.plain)
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 10, coordinateSpace: .local)
            .updating($dragOffset) { value, state, _ in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                let translation = value.translation.width
                if settledOffset == 0, translation > 0 { return }
                state = translation
            }
            .onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }

                let proposedOffset = max(-actionWidth, min(0, settledOffset + value.translation.width))
                let shouldOpen = proposedOffset <= -openThreshold

                withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
                    settledOffset = shouldOpen ? -actionWidth : 0
                }
                onOpenChange(shouldOpen)
            }
    }
}

struct LibraryItemRow: View {
    let item: LibraryItem
    let onSelect: () -> Void
    var showsPressFeedback: Bool = true

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMM d")
        return formatter
    }()

    var body: some View {
        if showsPressFeedback {
            Button(action: onSelect) {
                rowContent
            }
            .buttonStyle(PressableRowStyle())
        } else {
            rowContent
                .contentShape(Rectangle())
                .onTapGesture(perform: onSelect)
        }
    }

    private var rowContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            switch item {
            case .lyric(let file):
                lyricRow(file: file)
            case .recording(let recording):
                recordingRow(recording: recording)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func lyricRow(file: LyricFile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 10) {
                Text(file.title.isEmpty ? "Untitled" : file.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)

                Spacer()

                Text(Self.dateFormatter.string(from: file.updatedAt))
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1)
                    .foregroundStyle(Theme.muted.opacity(0.8))
            }

            HStack(alignment: .lastTextBaseline, spacing: 8) {
                Text(lyricPreview(for: file))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted.opacity(0.9))
                    .lineLimit(2)

                Spacer()

                itemIcon(systemName: "music.note", tint: Theme.accentPressed)
            }
        }
    }

    private func recordingRow(recording: Recording) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(recording.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)

                Spacer()

                Text(Self.dateFormatter.string(from: recording.updatedAt))
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1)
                    .foregroundStyle(Theme.muted.opacity(0.8))
            }

            HStack(alignment: .lastTextBaseline, spacing: 8) {
                Text(
                    "\(recording.formattedDuration) · Saved \(Self.dateFormatter.string(from: recording.updatedAt))"
                )
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted.opacity(0.9))
                .lineLimit(2)

                Spacer()

                itemIcon(systemName: "waveform", tint: Theme.accentPressed)
            }
        }
    }

    private func lyricPreview(for file: LyricFile) -> String {
        let trimmed = file.body.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Every song starts somewhere." : trimmed
    }

    private func itemIcon(systemName: String, tint: Color) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: 20, height: 20)
    }

}

struct PressableRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Theme.accentSoft : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
            .offset(y: configuration.isPressed ? 1 : 0)
    }
}

#Preview("Library (sample data)") {
    LibraryView()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}
