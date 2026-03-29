import SwiftUI
import UIKit

struct CollectionDetailView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let collection: Collection

    @State private var isEditing = false
    @State private var editedTitle: String
    @State private var selectedItem: LibraryItem?

    init(collection: Collection) {
        self.collection = collection
        self._editedTitle = State(initialValue: collection.title)
    }

    private var items: [LibraryItem] {
        appState.itemsInCollection(collection)
    }

    private var subtitle: String {
        let count = items.count
        return "\(count) \(count == 1 ? "item" : "items")"
    }

    var body: some View {
        ZStack(alignment: .top) {
            Theme.headerBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                headerView()

                ScrollView {
                    VStack(spacing: 16) {
                        if items.isEmpty {
                            emptyStateView
                        } else {
                            LazyVStack(spacing: 0) {
                                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                                    LibraryItemRow(item: item) {
                                        selectedItem = item
                                    }
                                    .contextMenu {
                                        Button(role: .destructive) {
                                            Task {
                                                await appState.removeFromCollection(item, collection: collection)
                                            }
                                        } label: {
                                            Label("Remove", systemImage: "folder.badge.minus")
                                        }
                                    }

                                    if index < items.count - 1 {
                                        Divider()
                                            .background(Theme.divider)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.top, 20)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 120)
                    .frame(maxWidth: .infinity)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.paper)
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
        .background(InteractivePopGestureEnabler())
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(item: $selectedItem) { item in
            switch item {
            case .lyric(let file):
                LyricEditorView(file: file)
            case .recording(let recording):
                PlaybackView(recording: recording)
            }
        }
        .onAppear {
            appState.isTabBarHidden = true
        }
        .onDisappear {
            appState.isTabBarHidden = false
        }
        .alert("Rename Collection", isPresented: $isEditing) {
            TextField("Title", text: $editedTitle)
            Button("Cancel", role: .cancel) {
                editedTitle = collection.title
            }
            Button("Save") {
                saveTitle()
            }
        }
    }

    private func headerView() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(width: 36, height: 36)
                        .background(Theme.paper)
                        .clipShape(Circle())
                }
                .buttonStyle(PressableScaleStyle())

                Spacer()

                Menu {
                    Button {
                        isEditing = true
                    } label: {
                        Label("Rename", systemImage: "pencil")
                    }

                    Divider()

                    Button(role: .destructive) {
                        Task {
                            await appState.deleteCollection(collection)
                            dismiss()
                        }
                    } label: {
                        Label("Delete Collection", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(width: 36, height: 36)
                        .background(Theme.paper)
                        .clipShape(Circle())
                }
            }

            Text("Collection")
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(2)
                .foregroundStyle(Theme.accent)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(Theme.accentSoft)
                .clipShape(Capsule())

            Text(collection.title)
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Text(subtitle)
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted.opacity(0.8))
        }
        .padding(.top, 6)
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private var emptyStateView: some View {
        VStack(spacing: 8) {
            Text("This collection is empty")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Text("Add lyrics or recordings from your library.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted.opacity(0.9))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 18)
        .background(Theme.accentSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private func saveTitle() {
        if editedTitle != collection.title && !editedTitle.isEmpty {
            var updated = collection
            updated.title = editedTitle
            Task {
                await appState.updateCollection(updated)
            }
        }
    }
}

private struct InteractivePopGestureEnabler: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        UIViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        DispatchQueue.main.async {
            guard let navigationController = uiViewController.navigationController else { return }
            navigationController.interactivePopGestureRecognizer?.isEnabled = true
            navigationController.interactivePopGestureRecognizer?.delegate = nil
        }
    }
}

#Preview("Collection Detail Populated") {
    NavigationStack {
        CollectionDetailView(collection: AppState.previewCollection())
    }
    .environment(AppState.preview())
    .environment(\.isPreview, true)
}

#Preview("Collection Detail Empty") {
    let state = AppState.preview()
    let emptyCollection = Collection(
        id: "collection-empty",
        title: "Voice Notes",
        description: "A fresh collection with no items yet"
    )
    state.collections.insert(emptyCollection, at: 0)

    return NavigationStack {
        CollectionDetailView(collection: emptyCollection)
    }
    .environment(state)
    .environment(\.isPreview, true)
}
