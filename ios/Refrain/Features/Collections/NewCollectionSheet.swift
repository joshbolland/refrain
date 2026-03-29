import SwiftUI

struct NewCollectionSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    var onCreated: ((Collection) -> Void)? = nil

    @State private var title = ""
    @State private var description = ""
    @State private var isCreating = false

    @FocusState private var isTitleFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Create collection")
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

            VStack(alignment: .leading, spacing: 4) {
                Text("Title")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.muted.opacity(0.7))

                TextField("Tour setlist", text: $title)
                    .textFieldStyle(.plain)
                    .focused($isTitleFocused)
                    .tint(Theme.accent)
                    .foregroundStyle(Theme.ink)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Theme.paper)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .stroke(Theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text("Description")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.muted.opacity(0.7))

                TextField("Optional notes", text: $description, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(3...6)
                    .tint(Theme.accent)
                    .foregroundStyle(Theme.ink)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Theme.paper)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .stroke(Theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))

            Button {
                Task { await createCollection() }
            } label: {
                Text(isCreating ? "Saving..." : "Create")
                    .frame(maxWidth: .infinity)
            }
            .primaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
            .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreating)
            .opacity(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreating ? 0.5 : 1)
        }
        .padding(24)
        .background(Theme.paper)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .onAppear {
            isTitleFocused = true
        }
    }

    private func createCollection() async {
        isCreating = true

        if let collection = await appState.createCollection(
            title: title,
            description: description.isEmpty ? nil : description
        ) {
            await MainActor.run {
                onCreated?(collection)
            }
        }

        dismiss()
    }
}

#Preview("New Collection Sheet") {
    NewCollectionSheet()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}
