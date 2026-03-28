import SwiftUI

private let collectionsCardHeight: CGFloat = 120

struct CollectionsView: View {
    @Environment(AppState.self) private var appState

    @State private var showNewCollectionSheet = false
    @State private var selectedCollection: Collection?

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    private var headerSubtitle: String {
        let collectionCount = appState.collections.count
        if collectionCount == 0 {
            return "Group lyrics and recordings for quick access."
        }

        let totalItems = appState.collections.reduce(0) { total, collection in
            let counts = appState.itemCount(for: collection)
            return total + counts.total
        }

        let collectionLabel = collectionCount == 1 ? "collection" : "collections"
        let itemLabel = totalItems == 1 ? "item" : "items"
        return "\(collectionCount) \(collectionLabel) • \(totalItems) \(itemLabel)"
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Theme.headerBackground
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    headerView()

                    ScrollView {
                        VStack(spacing: 16) {
                            if appState.collections.isEmpty {
                                createCollectionCard
                                emptyCollectionsCard
                            } else {
                                LazyVGrid(columns: columns, spacing: 12) {
                                    createCollectionCard

                                    ForEach(appState.collections) { collection in
                                        CollectionCard(
                                            collection: collection,
                                            counts: appState.itemCount(for: collection)
                                        )
                                        .onTapGesture {
                                            selectedCollection = collection
                                        }
                                        .contextMenu {
                                            Button {
                                                selectedCollection = collection
                                            } label: {
                                                Label("Open", systemImage: "folder")
                                            }

                                            Button(role: .destructive) {
                                                Task {
                                                    await appState.deleteCollection(collection)
                                                }
                                            } label: {
                                                Label("Delete", systemImage: "trash")
                                            }
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
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showNewCollectionSheet) {
                NewCollectionSheet()
            }
            .navigationDestination(item: $selectedCollection) { collection in
                CollectionDetailView(collection: collection)
            }
        }
    }

    private func headerView() -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Collections")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                Text(headerSubtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted.opacity(0.8))
            }

            Spacer()

            UserAvatar(user: appState.currentUser)
        }
        .padding(.top, 6)
        .padding(.horizontal, 20)
        .padding(.bottom, 28)
    }

    private var createCollectionCard: some View {
        Button {
            showNewCollectionSheet = true
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text("+")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 40, height: 40)
                    .background(Theme.paper)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color(hex: "D7DDFF"), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Text("Create collection")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.accent)

                Text("Group lyrics or recordings.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted.opacity(0.8))
            }
            .frame(maxWidth: .infinity, minHeight: collectionsCardHeight, alignment: .topLeading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Theme.accentSoft)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .stroke(Color(hex: "D7DDFF"), lineWidth: 2)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
        .buttonStyle(PressableScaleStyle())
    }

    private var emptyCollectionsCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("No collections yet")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Text("Draft a collection to keep lyrics and recordings together.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted.opacity(0.8))
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }
}

struct CollectionCard: View {
    let collection: Collection
    let counts: (total: Int, lyrics: Int, recordings: Int)

    var body: some View {
        let countLabel = counts.total == 1 ? "1 item" : "\(counts.total) items"

        return VStack(alignment: .leading, spacing: 8) {
            Text(collection.title.isEmpty ? "Untitled collection" : collection.title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .lineLimit(2)

            Text(countLabel)
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted.opacity(0.8))
        }
        .frame(maxWidth: .infinity, minHeight: collectionsCardHeight, alignment: .topLeading)
        .padding(.horizontal, 16)
        .padding(.top, 18)
        .padding(.bottom, 6)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }
}

#Preview {
    CollectionsView()
        .environment(AppState())
}
