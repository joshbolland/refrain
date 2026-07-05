import SwiftUI

struct NewProjectSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    var onCreated: ((Project) -> Void)? = nil

    @State private var title = ""
    @State private var description = ""
    @State private var isCreating = false
    @State private var didScheduleFocus = false

    @FocusState private var isTitleFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Text("Create project")
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

                VStack(alignment: .leading, spacing: 14) {
                    fieldLabel("Title")

                    TextField("Tour setlist", text: $title)
                        .textFieldStyle(.plain)
                        .focused($isTitleFocused)
                        .submitLabel(.next)
                        .tint(Theme.accent)
                        .foregroundStyle(Theme.ink)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(Theme.paper)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                        .stroke(Theme.divider, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))

                VStack(alignment: .leading, spacing: 14) {
                    fieldLabel("Description")

                    TextField("Optional notes", text: $description, axis: .vertical)
                        .textFieldStyle(.plain)
                        .lineLimit(4...8)
                        .tint(Theme.accent)
                        .foregroundStyle(Theme.ink)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(Theme.paper)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                        .stroke(Theme.divider, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 24)
            .padding(.top, 28)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .background(Theme.paper)
        .safeAreaInset(edge: .bottom) {
            Button {
                Task { await createProject() }
            } label: {
                Text(isCreating ? "Saving..." : "Create")
                    .frame(maxWidth: .infinity)
            }
            .primaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
            .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreating)
            .opacity(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreating ? 0.5 : 1)
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .padding(.bottom, 12)
            .background(Theme.paper)
        }
        .scrollDismissesKeyboard(.interactively)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .task {
            guard !didScheduleFocus else { return }
            didScheduleFocus = true
            try? await Task.sleep(for: .milliseconds(150))
            isTitleFocused = true
        }
    }

    private func fieldLabel(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .textCase(.uppercase)
            .tracking(1.2)
            .foregroundStyle(Theme.muted.opacity(0.7))
    }

    private func createProject() async {
        isCreating = true

        if let project = await appState.createProject(
            title: title,
            description: description.isEmpty ? nil : description
        ) {
            await MainActor.run {
                onCreated?(project)
            }
        }

        dismiss()
    }
}

#Preview("New Project Sheet") {
    NewProjectSheet()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}
