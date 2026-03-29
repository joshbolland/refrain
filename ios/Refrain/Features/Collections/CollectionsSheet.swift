import SwiftUI

struct CollectionsSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let item: LibraryItem

    @State private var showNewCollectionSheet = false

    private var assignedCollectionIds: Set<String> {
        Set(appState.collectionsContaining(item).map { $0.id })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Add to Collection")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                Spacer()

                Button("Close") {
                    dismiss()
                }
                .font(.system(size: 12, weight: .semibold))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(Theme.muted)
            }

            if appState.collections.isEmpty {
                VStack(spacing: 10) {
                    Text("No collections")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)

                    Text("Create one to start organizing.")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.muted.opacity(0.8))

                    Button {
                        showNewCollectionSheet = true
                    } label: {
                        Text("Create Collection")
                            .frame(maxWidth: .infinity)
                    }
                    .secondaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .padding(.horizontal, 12)
                .background(Theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            } else {
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(appState.collections) { collection in
                            CollectionToggleRow(
                                collection: collection,
                                isSelected: assignedCollectionIds.contains(collection.id),
                                onToggle: { isSelected in
                                    Task {
                                        if isSelected {
                                            await appState.addToCollection(item, collection: collection)
                                        } else {
                                            await appState.removeFromCollection(item, collection: collection)
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            }

            Button {
                showNewCollectionSheet = true
            } label: {
                Text("New Collection")
                    .frame(maxWidth: .infinity)
            }
            .primaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
        }
        .padding(24)
        .background(Theme.paper)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .sheet(isPresented: $showNewCollectionSheet) {
            NewCollectionSheet()
        }
    }
}

struct CollectionToggleRow: View {
    let collection: Collection
    let isSelected: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        Button {
            onToggle(!isSelected)
        } label: {
            HStack {
                Text(collection.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? Theme.accent : Theme.muted.opacity(0.6))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.paper)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .stroke(Theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        }
        .buttonStyle(PressableScaleStyle())
    }
}

#Preview("Collections Sheet Populated") {
    CollectionsSheet(item: .lyric(AppState.previewLyric()))
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}

#Preview("Collections Sheet Empty") {
    CollectionsSheet(item: .recording(Recording(title: "Voice memo idea")))
        .environment(AppState.preview(populated: false))
        .environment(\.isPreview, true)
}
