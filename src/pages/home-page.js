export default function homePage({ app, navigate }) {
	app.innerHTML = `
		<section>
			<h1>Linpia</h1>
			<p>누구나 작은 온라인 박물관을 만들 수 있는 사이트</p>
			<a href="/create" data-link>전시관 만들기</a>
		</section>
	`;

	return () => {
		// 필요하면 cleanup
	};
}