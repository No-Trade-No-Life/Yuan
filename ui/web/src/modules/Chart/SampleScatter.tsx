import { useValue } from '../Data';
import { registerPage, usePageParams } from '../Pages';
import { DataAnalysis3DChart } from './DataAnalysis3DChart';

registerPage('SampleScatter', () => {
  const { id } = usePageParams();
  const [data] = useValue(id, []);

  return <DataAnalysis3DChart data={data} />;
});
